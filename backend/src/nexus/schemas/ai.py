from __future__ import annotations

from pydantic import BaseModel


class AIAnalysisRequest(BaseModel):
    scan_id: str


class AIAnalysisResponse(BaseModel):
    overall_risk: str
    priority_order: list[str]
    top_remediation: str
    summary: str


class AIChatRequest(BaseModel):
    message: str
    scan_id: str | None = None


class AIChatResponse(BaseModel):
    response: str


class AIAnomalyRequest(BaseModel):
    device_id: str


class AnomalyItem(BaseModel):
    severity: str
    metric: str
    description: str
    recommendation: str


class AIAnomalyResponse(BaseModel):
    anomalies: list[AnomalyItem]
    device_health: str
    summary: str
