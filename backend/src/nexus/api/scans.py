from __future__ import annotations

import asyncio
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
from nexus.scanner.engine import ScanEngine
from nexus.schemas.scan import (
    ScanDetailResponse,
    ScanRequest,
    ScanResponse,
)

templates_dir = Path(__file__).parent.parent / "templates"
jinja_env = Environment(loader=FileSystemLoader(str(templates_dir)))

router = APIRouter(prefix="/scans", tags=["scans"])


@router.get("/", response_model=list[ScanResponse])
async def list_scans(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", max_length=100),
):
    query = (
        select(Scan)
        .join(Device)
        .where(Device.owner_id == user.id)
    )
    if search:
        query = query.where(
            Scan.scan_type.ilike(f"%{search}%")
            | Scan.status.ilike(f"%{search}%")
            | Scan.severity.ilike(f"%{search}%")
        )
    query = query.offset(skip).limit(limit).order_by(Scan.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


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
    scan = Scan(
        device_id=body.device_id,
        scan_type=body.scan_type,
        status="pending",
        created_by_id=user.id,
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    asyncio.create_task(ScanEngine().run_scan(scan.id))
    return scan


@router.get("/{scan_id}", response_model=ScanDetailResponse)
async def get_scan(
    scan_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scan)
        .options(selectinload(Scan.findings))
        .where(Scan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )
    return scan


@router.get("/{scan_id}/report")
async def get_scan_report(
    scan_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scan)
        .options(selectinload(Scan.findings), selectinload(Scan.device))
        .where(Scan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )
    if scan.created_by_id != user.id and scan.device.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )

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
        scan_type=scan.scan_type,
        status=scan.status,
        completed_at=(
            scan.completed_at.strftime("%Y-%m-%d %H:%M UTC")
            if scan.completed_at else "N/A"
        ),
        scan_id=scan.id,
        score=scan.score or 0,
        severity=scan.severity or "unknown",
        summary=scan.summary or "",
        findings=findings_data,
    )

    pdf = HTML(string=html).write_pdf()
    filename = f"scan_{scan_id[:8]}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
