from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ScanRequest(BaseModel):
    device_id: str
    scan_type: str = Field(default="full", pattern="^(full|quick|headers|ssl)$")


class ScanResponse(BaseModel):
    id: str
    device_id: str
    scan_type: str
    status: str
    severity: str | None
    score: float | None
    created_by_id: str
    started_at: datetime | None
    completed_at: datetime | None
    summary: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FindingResponse(BaseModel):
    id: str
    scan_id: str
    check_type: str
    severity: str
    title: str
    description: str | None
    remediation: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanDetailResponse(ScanResponse):
    findings: list[FindingResponse] = []
