from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class RecentScanItem(BaseModel):
    id: str
    device_name: str
    scan_type: str
    severity: str | None
    score: float | None
    status: str
    created_at: datetime


class RecentAlertItem(BaseModel):
    id: str
    device_name: str
    title: str
    severity: str
    alert_type: str
    created_at: datetime


class FindingsBreakdown(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    info: int = 0


class DashboardStats(BaseModel):
    total_devices: int
    online_devices: int
    offline_devices: int
    total_scans: int
    critical_findings: int
    active_alerts: int
    total_alerts: int
    security_score: float | None
    findings_breakdown: FindingsBreakdown
    recent_scans: list[RecentScanItem]
    recent_alerts: list[RecentAlertItem]
