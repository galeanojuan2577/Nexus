from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from nexus.models.scan import Scan


class ScanRequest(BaseModel):
    device_id: str
    scan_type: str = Field(default="quick", pattern="^(full|quick|headers|ssl|normal|deep)$")
    level: int | None = Field(default=None, ge=1, le=3)


class ScanResponse(BaseModel):
    id: str
    device_id: str
    scan_type: str
    level: int
    status: str
    progress: int
    stage: str | None
    severity: str | None
    score: float | None
    created_by_id: str
    started_at: datetime | None
    completed_at: datetime | None
    summary: str | None
    interpretation: str | None = None
    error: str | None = None
    created_at: datetime
    device_name: str | None = None
    device_host: str | None = None
    device_port: int | None = None
    target: str | None = None

    model_config = {"from_attributes": True}


def scan_to_response(scan: Scan) -> ScanResponse:
    data = ScanResponse.model_validate(scan)
    device = getattr(scan, "device", None)
    if device is not None:
        data.device_name = device.name
        data.device_host = device.host
        data.device_port = device.port
        data.target = f"{device.host}:{device.port}" if device.port else device.host
    return data


class FindingResponse(BaseModel):
    id: str
    scan_id: str
    check_type: str
    severity: str
    title: str
    description: str | None
    remediation: str | None
    attack_technique: str | None = None
    attack_tactic: str | None = None
    attack_tactic_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScanDetailResponse(ScanResponse):
    findings: list[FindingResponse] = []


class ScanLogResponse(BaseModel):
    scan_id: str
    lines: list[str] = []
    offset: int = 0
    total: int = 0
