from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

logger = logging.getLogger(__name__)

ProgressCb = Callable[[int, str], Awaitable[None]]

ACTIVE_SCAN_STATUSES = ("pending", "running")

scan_tasks: dict[str, asyncio.Task[None]] = {}
scan_processes: dict[str, asyncio.subprocess.Process] = {}


def register_task(scan_id: str, task: asyncio.Task[None]) -> None:
    scan_tasks[scan_id] = task

    def _pop(t: asyncio.Task[None], sid: str = scan_id) -> None:
        scan_tasks.pop(sid, None)
        scan_processes.pop(sid, None)

    task.add_done_callback(_pop)


def get_task(scan_id: str) -> asyncio.Task[None] | None:
    return scan_tasks.get(scan_id)


def register_process(scan_id: str, proc: asyncio.subprocess.Process) -> None:
    scan_processes[scan_id] = proc


def unregister_process(scan_id: str) -> None:
    scan_processes.pop(scan_id, None)


async def terminate_process(scan_id: str) -> bool:
    proc = scan_processes.get(scan_id)
    if not proc or proc.returncode is not None:
        unregister_process(scan_id)
        return False
    try:
        proc.terminate()
        try:
            await asyncio.wait_for(proc.wait(), timeout=3)
        except TimeoutError:
            proc.kill()
            await proc.wait()
        return True
    except ProcessLookupError:
        return False
    finally:
        unregister_process(scan_id)


async def cancel_scan_task(scan_id: str) -> bool:
    """Cancel asyncio task and any host subprocess. Returns True if requested."""
    killed = await terminate_process(scan_id)
    task = scan_tasks.get(scan_id)
    current = asyncio.current_task()
    if task and task is not current and not task.done():
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
        return True
    return killed or bool(task and not task.done())


async def reap_stale_scans() -> int:
    """Mark orphaned pending/running scans as failed on startup."""
    from datetime import UTC, datetime

    from sqlalchemy import select, update

    from nexus.core.database import async_session
    from nexus.models.scan import Scan

    async with async_session() as db:
        result = await db.execute(
            select(Scan.id).where(Scan.status.in_(("pending", "running")))
        )
        stale_ids = [row[0] for row in result.all()]
        active = {sid for sid, t in scan_tasks.items() if not t.done()}
        to_fail = [sid for sid in stale_ids if sid not in active]
        if not to_fail:
            return 0
        await db.execute(
            update(Scan)
            .where(Scan.id.in_(to_fail))
            .values(
                status="failed",
                error="Interrupted: backend restarted while scan was active",
                completed_at=datetime.now(UTC),
                stage="failed",
            )
        )
        await db.commit()
        logger.warning("Reaped %d stale scan(s): %s", len(to_fail), to_fail)
        return len(to_fail)
