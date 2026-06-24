from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from nexus.core.database import get_db
from nexus.core.security import get_current_user
from nexus.models.alert import Alert
from nexus.models.device import Device
from nexus.models.scan import Finding, Scan
from nexus.models.user import User
from nexus.schemas.dashboard import (
    DashboardStats,
    FindingsBreakdown,
    RecentAlertItem,
    RecentScanItem,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    devices_result = await db.execute(
        select(
            func.count(Device.id).label("total"),
            func.count(Device.id).filter(Device.status == "online").label("online"),
            func.count(Device.id).filter(Device.status == "offline").label("offline"),
        ).where(Device.owner_id == user.id)
    )
    devices_row = devices_result.one()

    scans_result = await db.execute(
        select(func.count(Scan.id))
        .select_from(Scan)
        .join(Device)
        .where(Device.owner_id == user.id)
    )
    total_scans = scans_result.scalar() or 0

    findings_result = await db.execute(
        select(func.count(Finding.id))
        .select_from(Finding)
        .join(Scan)
        .join(Device)
        .where(Device.owner_id == user.id, Finding.severity == "critical")
    )
    critical_findings = findings_result.scalar() or 0

    alerts_result = await db.execute(
        select(
            func.count(Alert.id).filter(Alert.resolved.is_(False)).label("active"),
            func.count(Alert.id).label("total"),
        )
        .select_from(Alert)
        .join(Device)
        .where(Device.owner_id == user.id)
    )
    alerts_row = alerts_result.one()

    severity_result = await db.execute(
        select(
            func.count(Finding.id).filter(Finding.severity == "critical").label("critical"),
            func.count(Finding.id).filter(Finding.severity == "high").label("high"),
            func.count(Finding.id).filter(Finding.severity == "medium").label("medium"),
            func.count(Finding.id).filter(Finding.severity == "low").label("low"),
            func.count(Finding.id).filter(Finding.severity == "info").label("info"),
        )
        .select_from(Finding)
        .join(Scan)
        .join(Device)
        .where(Device.owner_id == user.id)
    )
    sev_row = severity_result.one()

    latest_scan_result = await db.execute(
        select(Scan.score)
        .select_from(Scan)
        .join(Device)
        .where(Device.owner_id == user.id, Scan.score.isnot(None))
        .order_by(Scan.created_at.desc())
        .limit(1)
    )
    latest_score = latest_scan_result.scalar()

    recent_scans_result = await db.execute(
        select(Scan)
        .options(selectinload(Scan.device))
        .join(Device)
        .where(Device.owner_id == user.id)
        .order_by(Scan.created_at.desc())
        .limit(5)
    )
    recent_scans = [
        RecentScanItem(
            id=s.id,
            device_name=s.device.name,
            scan_type=s.scan_type,
            severity=s.severity,
            score=s.score,
            status=s.status,
            created_at=s.created_at,
        )
        for s in recent_scans_result.scalars()
    ]

    recent_alerts_result = await db.execute(
        select(Alert)
        .options(selectinload(Alert.device))
        .join(Device)
        .where(
            Device.owner_id == user.id,
            Alert.resolved.is_(False),
        )
        .order_by(Alert.created_at.desc())
        .limit(5)
    )
    recent_alerts = [
        RecentAlertItem(
            id=a.id,
            device_name=a.device.name,
            title=a.title,
            severity=a.severity,
            alert_type=a.alert_type,
            created_at=a.created_at,
        )
        for a in recent_alerts_result.scalars()
    ]

    return DashboardStats(
        total_devices=devices_row.total or 0,
        online_devices=devices_row.online or 0,
        offline_devices=devices_row.offline or 0,
        total_scans=total_scans,
        critical_findings=critical_findings,
        active_alerts=alerts_row.active or 0,
        total_alerts=alerts_row.total or 0,
        security_score=latest_score,
        findings_breakdown=FindingsBreakdown(
            critical=sev_row.critical or 0,
            high=sev_row.high or 0,
            medium=sev_row.medium or 0,
            low=sev_row.low or 0,
            info=sev_row.info or 0,
        ),
        recent_scans=recent_scans,
        recent_alerts=recent_alerts,
    )
