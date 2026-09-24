from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from nexus.core.database import async_session
from nexus.models.scan import Finding, Scan
from nexus.scanner.checks import run_all_checks
from nexus.scanner.console import clear_log, emit_log
from nexus.scanner.host_recon import run_host_recon
from nexus.scanner.interpret import interpret_scan
from nexus.scanner.registry import terminate_process, unregister_process
from nexus.services.detection import enrich_findings_and_raise_alerts
from nexus.services.websocket import manager

logger = logging.getLogger(__name__)

ProgressCb = Callable[[int, str], Awaitable[None]]

ACTIVE_STATUSES = ("pending", "running")


async def _noop(_p: int, _s: str) -> None:
    return None


class ScanEngine:
    async def run_scan(self, scan_id: str) -> None:
        async with async_session() as db:
            result = await db.execute(
                select(Scan).options(selectinload(Scan.device)).where(Scan.id == scan_id)
            )
            scan = result.scalar_one_or_none()
            if not scan:
                logger.error("Scan %s not found", scan_id)
                return

            if scan.status == "cancelled":
                return

            clear_log(scan_id)
            scan.status = "running"
            scan.started_at = datetime.now(UTC)
            scan.progress = 2
            scan.stage = "init"
            scan.error = None
            await db.commit()
            await self._broadcast(scan_id, scan)
            await emit_log(
                scan_id, f"[init] scan {scan_id} · type={scan.scan_type} L{scan.level or 1}"
            )
            await emit_log(scan_id, f"[target] {scan.device.host}:{scan.device.port}")

            # 0 or negative = no global cap; scans run as long as needed.
            # Stuck tools are handled by the per-recon stall watchdog.
            pipeline_timeout_s = int(os.environ.get("NEXUS_SCAN_TIMEOUT", "0"))
            try:
                if pipeline_timeout_s > 0:
                    async with asyncio.timeout(pipeline_timeout_s):
                        await self._run_pipeline(scan_id, db, scan)
                else:
                    await self._run_pipeline(scan_id, db, scan)
            except TimeoutError:
                await self._finish_failed(
                    db,
                    scan,
                    scan_id,
                    f"Scan timed out after {pipeline_timeout_s // 60} minutes",
                    stage="timeout",
                )
            except asyncio.CancelledError:
                await self._finish_cancelled(db, scan, scan_id)
                raise
            except Exception as e:
                logger.exception("Scan %s failed", scan_id)
                await self._finish_failed(db, scan, scan_id, str(e), stage="failed")

    async def _run_pipeline(self, scan_id: str, db: Any, scan: Any) -> None:
        device = scan.device
        target = f"{device.host}:{device.port}" if device.port else device.host
        level = scan.level or 1

        last_progress_ts = 0.0
        last_progress_pct = -1

        async def progress(pct: int, stage: str) -> None:
            nonlocal last_progress_ts, last_progress_pct
            now = time.monotonic()
            clamped = max(0, min(100, int(pct)))
            force = clamped <= last_progress_pct or now - last_progress_ts >= 1.0
            if not force:
                return
            last_progress_ts = now
            last_progress_pct = clamped
            scan.progress = clamped
            scan.stage = stage
            await db.commit()
            await self._broadcast(scan_id, scan)

        raw_findings: list[dict[str, Any]] = []

        await progress(8, "security_headers")
        await emit_log(scan_id, "[1/4] Security headers + HTTP checks…")
        headers_f = await run_all_checks(target, self._builtin_type(scan.scan_type))
        raw_findings.extend(headers_f)
        await progress(30, "builtin_checks_done")
        await emit_log(scan_id, f"[2/4] {len(headers_f)} check(s) HTTP locales")

        recon_stats: dict = {"skipped": True}
        if scan.scan_type in ("quick", "normal", "deep", "full") and level >= 1:
            await emit_log(scan_id, f"[3/4] Host recon nivel {level}…")
            recon_f, recon_stats = await run_host_recon(scan_id, target, level, progress)
            raw_findings.extend(recon_f)
            await emit_log(
                scan_id,
                f"[3/4] recon ok · subdominios={recon_stats.get('subdomains', 0)} "
                f"live={recon_stats.get('live_hosts', 0)} "
                f"puertos={recon_stats.get('open_ports', 0)}",
            )
            if recon_stats.get("timeout"):
                raw_findings.append(
                    {
                        "check_type": "recon_timeout",
                        "severity": "medium",
                        "title": "Host recon timed out (partial results)",
                        "description": (
                            "recon_pro exceeded the global scan budget. "
                            "Findings below may be incomplete."
                        ),
                        "remediation": "Re-run at a lower level or with a longer timeout",
                        "raw_data": str(recon_stats),
                    }
                )
            if recon_stats.get("stalled"):
                raw_findings.append(
                    {
                        "check_type": "recon_stalled",
                        "severity": "medium",
                        "title": "Stalled tool killed (partial results)",
                        "description": (
                            "A recon tool produced no output for the stall window "
                            "and was terminated so the scan could continue. "
                            "Findings below may be incomplete."
                        ),
                        "remediation": "Re-run the scan or investigate the stalled tool",
                        "raw_data": str(recon_stats),
                    }
                )
        else:
            await progress(55, "host_recon_skipped")
            await emit_log(scan_id, "[3/4] Host recon omitido para este tipo de scan")

        await progress(75, "persist_findings")
        await emit_log(scan_id, f"[4/4] Persistiendo {len(raw_findings)} finding(s)…")
        for f in raw_findings:
            db.add(
                Finding(
                    scan_id=scan.id,
                    check_type=f["check_type"],
                    severity=f["severity"],
                    title=f["title"][:500],
                    description=f.get("description", ""),
                    remediation=f.get("remediation", ""),
                    raw_data=f.get("raw_data"),
                )
            )

        severity = self._calculate_severity(raw_findings)
        scan.severity = severity
        scan.score = self._calculate_score(raw_findings)
        scan.summary = (
            f"Found {len(raw_findings)} issues. Severity: {severity}. Score: {scan.score:.1f}/100"
        )
        scan.stage = "detection"
        await db.commit()

        try:
            await enrich_findings_and_raise_alerts(scan_id)
        except Exception as det_err:
            logger.error("Detection enrichment failed for %s: %s", scan_id, det_err)

        await progress(95, "interpretation")
        result = await db.execute(select(Finding).where(Finding.scan_id == scan_id))
        persisted = list(result.scalars().all())
        finding_dicts = [
            {
                "check_type": f.check_type,
                "severity": f.severity,
                "title": f.title,
                "description": f.description,
                "remediation": f.remediation,
                "attack_technique": f.attack_technique,
            }
            for f in persisted
        ]
        scan.interpretation = interpret_scan(
            finding_dicts,
            level=level,
            scan_type=scan.scan_type,
            target=target,
            recon_stats=recon_stats if isinstance(recon_stats, dict) else None,
        )
        scan.status = "completed"
        scan.completed_at = datetime.now(UTC)
        scan.progress = 100
        scan.stage = "completed"
        await db.commit()
        await emit_log(
            scan_id,
            f"[✓] completado · findings={len(persisted)} severity={severity} "
            f"score={scan.score:.1f}",
        )
        await self._broadcast(scan_id, scan)
        logger.info(
            "Scan %s completed: %d findings, score=%.1f",
            scan_id,
            len(persisted),
            scan.score or 0,
        )

    async def _finish_failed(
        self, db: Any, scan: Any, scan_id: str, message: str, stage: str
    ) -> None:
        scan.status = "failed"
        scan.completed_at = datetime.now(UTC)
        scan.error = message
        scan.summary = f"Scan failed: {message}"
        scan.stage = stage
        await db.commit()
        # Never leave orphaned recon children behind on failure.
        await terminate_process(scan_id)
        await emit_log(scan_id, f"[✗] failed: {message}")
        await self._broadcast(scan_id, scan)
        logger.error("Scan %s failed: %s", scan_id, message)

    async def _finish_cancelled(self, db: Any, scan: Any, scan_id: str) -> None:
        try:
            scan.status = "cancelled"
            scan.completed_at = datetime.now(UTC)
            scan.stage = "cancelled"
            scan.error = "Cancelled by user"
            scan.summary = "Scan cancelled by user"
            await db.commit()
            await emit_log(scan_id, "[–] cancelado por el usuario")
            await self._broadcast(scan_id, scan)
            logger.info("Scan %s cancelled", scan_id)
        except Exception:
            logger.exception("Failed to persist cancelled state for %s", scan_id)
        finally:
            from nexus.scanner.registry import terminate_process

            await terminate_process(scan_id)
            unregister_process(scan_id)

    async def _broadcast(self, scan_id: str, scan: Any) -> None:
        try:
            await manager.broadcast(
                "scan.progress",
                {
                    "id": scan_id,
                    "status": scan.status,
                    "progress": scan.progress,
                    "stage": scan.stage,
                    "severity": scan.severity,
                    "score": scan.score,
                    "summary": scan.summary,
                },
            )
        except Exception:
            logger.debug("WS broadcast failed for %s", scan_id, exc_info=True)

    @staticmethod
    def _builtin_type(scan_type: str) -> str:
        if scan_type in ("normal", "deep"):
            return "full"
        if scan_type in ("quick",):
            return "quick"
        return scan_type

    def _calculate_severity(self, findings: list[dict]) -> str:
        severities = {f["severity"] for f in findings}
        for s in ("critical", "high", "medium", "low", "info"):
            if s in severities:
                return s
        return "pass"

    def _calculate_score(self, findings: list[dict]) -> float:
        weights = {"critical": 25, "high": 15, "medium": 10, "low": 5, "info": 1}
        deductions = sum(weights.get(f["severity"], 0) for f in findings)
        return max(0.0, 100.0 - deductions)


async def start_scan_task(scan_id: str) -> None:
    from nexus.scanner.registry import register_task

    task = asyncio.create_task(ScanEngine().run_scan(scan_id))
    register_task(scan_id, task)
