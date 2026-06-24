from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AlertResponse(BaseModel):
    id: str
    device_id: str
    alert_type: str
    severity: str
    title: str
    message: str | None
    resolved: bool
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class AlertStats(BaseModel):
    total: int
    critical: int
    warning: int
    info: int
    resolved: int
