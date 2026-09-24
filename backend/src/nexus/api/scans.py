from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from weasyprint import HTML

from nexus.core.database import get_db
from nexus.core.security import get_current_user
from nexus.models.device import Device
from nexus.models.scan import Scan
from nexus.models.user import User
from nexus.scanner.console import get_log
from nexus.scanner.engine import start_scan_task
from nexus.scanner.registry import ACTIVE_SCAN_STATUSES, cancel_scan_task
from nexus.schemas.scan import (
    ScanDetailResponse,
    ScanLogResponse,
    ScanRequest,
    ScanResponse,
    scan_to_response,
)

templates_dir = Path(__file__).parent.parent / "templates"
jinja_env = Environment(loader=FileSystemLoader(str(templates_dir)))

router = APIRouter(prefix="/scans", tags=["scans"])

LEVEL_FOR_TYPE = {
    "quick": 1,
    "headers": 1,
    "ssl": 1,
    "full": 2,
    "normal": 2,
    "deep": 3,
}


async def _get_owned_scan(
    scan_id: str, db: AsyncSession, user: User
) -> Scan:
    result = await db.execute(
        select(Scan)
        .join(Device)
        .options(selectinload(Scan.findings), selectinload(Scan.device))
        .where(Scan.id == scan_id, Device.owner_id == user.id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )
    return scan


@router.get("/", response_model=list[ScanResponse])
async def list_scans(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", max_length=100),
    device_id: str | None = Query(None),
    level: int | None = Query(None, ge=1, le=3),
):
    query = (
        select(Scan)
        .options(selectinload(Scan.device))
        .join(Device)
        .where(Device.owner_id == user.id)
    )
    if search:
        query = query.where(
            Scan.scan_type.ilike(f"%{search}%")
            | Scan.status.ilike(f"%{search}%")
            | Scan.severity.ilike(f"%{search}%")
            | Device.name.ilike(f"%{search}%")
            | Device.host.ilike(f"%{search}%")
        )
    if device_id:
        query = query.where(Scan.device_id == device_id)
    if level is not None:
        query = query.where(Scan.level == level)
    query = query.offset(skip).limit(limit).order_by(Scan.created_at.desc())
    result = await db.execute(query)
    return [scan_to_response(s) for s in result.scalars().all()]


@router.post("/", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
async def create_scan(
    body: ScanRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    device_result = await db.execute(
        select(Device).where(Device.id == body.device_id, Device.owner_id == user.id)
    )
    device = device_result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    level = body.level or LEVEL_FOR_TYPE.get(body.scan_type, 1)
    scan = Scan(
        device_id=body.device_id,
        scan_type=body.scan_type,
        level=level,
        status="pending",
        progress=0,
        stage="queued",
        created_by_id=user.id,
    )
    db.add(scan)
    await db.commit()
    created = await _get_owned_scan(scan.id, db, user)
    # Keep a strong reference so the task cannot be GC'd
    await start_scan_task(scan.id)
    return scan_to_response(created)


@router.post("/{scan_id}/cancel", response_model=ScanResponse)
async def cancel_scan(
    scan_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    scan = await _get_owned_scan(scan_id, db, user)
    if scan.status not in ACTIVE_SCAN_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel scan in status '{scan.status}'",
        )
    await cancel_scan_task(scan.id)
    # If the engine task is gone (e.g. stuck pending), mark cancelled now
    await db.refresh(scan)
    if scan.status in ACTIVE_SCAN_STATUSES:
        scan.status = "cancelled"
        scan.stage = "cancelled"
        scan.error = "Cancelled by user"
        scan.summary = "Scan cancelled by user"
        scan.completed_at = datetime.now(UTC)
        await db.commit()
        scan = await _get_owned_scan(scan_id, db, user)
    return scan_to_response(scan)


@router.get("/{scan_id}", response_model=ScanDetailResponse)
async def get_scan(
    scan_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    scan = await _get_owned_scan(scan_id, db, user)
    detail = ScanDetailResponse.model_validate(scan)
    base = scan_to_response(scan)
    for field in (
        "device_name",
        "device_host",
        "device_port",
        "target",
    ):
        setattr(detail, field, getattr(base, field))
    return detail


@router.get("/{scan_id}/log", response_model=ScanLogResponse)
async def get_scan_log(
    scan_id: str,
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await _get_owned_scan(scan_id, db, user)
    return get_log(scan_id, offset=offset)


@router.get("/{scan_id}/report")
async def get_scan_report(
    scan_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    scan = await _get_owned_scan(scan_id, db, user)

    findings_data = [
        {
            "severity": f.severity,
            "check_type": f.check_type,
            "title": f.title,
            "description": f.description or "",
            "remediation": f.remediation or "",
        }
        for f in scan.findings
    ]

    html = jinja_env.get_template("scan_report.html").render(
        target=f"{scan.device.host}:{scan.device.port}",
        device_name=scan.device.name,
        device_host=scan.device.host,
        device_port=scan.device.port,
        scan_type=scan.scan_type,
        level=scan.level,
        level_label={1: "Quick · L1", 2: "Normal · L2", 3: "Deep · L3"}.get(
            scan.level, f"L{scan.level}"
        ),
        status=scan.status,
        completed_at=(
            scan.completed_at.strftime("%Y-%m-%d %H:%M UTC")
            if scan.completed_at
            else "N/A"
        ),
        scan_id=scan.id,
        score=scan.score or 0,
        severity=scan.severity or "unknown",
        summary=scan.summary or "",
        interpretation=scan.interpretation or "",
        findings=findings_data,
    )

    pdf = HTML(string=html).write_pdf()
    filename = f"scan_{scan_id[:8]}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
