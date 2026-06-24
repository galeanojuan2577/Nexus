from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from nexus.ai.analyzer import AIAnalyzer
from nexus.core.database import get_db
from nexus.core.security import get_current_user
from nexus.models.alert import Alert
from nexus.models.device import Device
from nexus.models.scan import Scan
from nexus.models.user import User
from nexus.schemas.ai import (
    AIAnalysisRequest,
    AIAnalysisResponse,
    AIAnomalyRequest,
    AIAnomalyResponse,
    AIChatRequest,
    AIChatResponse,
    AnomalyItem,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])
analyzer = AIAnalyzer()


@router.post("/analyze", response_model=AIAnalysisResponse)
async def analyze_findings(
    body: AIAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scan)
        .options(selectinload(Scan.findings))
        .where(Scan.id == body.scan_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan not found",
        )
    if not scan.findings:
        return AIAnalysisResponse(
            overall_risk="pass",
            priority_order=[],
            top_remediation="No findings to analyze",
            summary="Scan completed with no issues detected",
        )

    findings_data = [
        {
            "id": f.id,
            "check_type": f.check_type,
            "severity": f.severity,
            "title": f.title,
            "description": f.description,
        }
        for f in scan.findings
    ]
    result = await analyzer.analyze_findings(findings_data)
    return AIAnalysisResponse(
        overall_risk=result.get("overall_risk", "medium"),
        priority_order=result.get("priority_order", []),
        top_remediation=result.get(
            "top_remediation", "Review findings manually"
        ),
        summary=result.get(
            "summary",
            f"Analysis complete. Found {len(scan.findings)} issues.",
        ),
    )


@router.post("/anomalies", response_model=AIAnomalyResponse)
async def detect_anomalies(
    body: AIAnomalyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Device).where(
            Device.id == body.device_id,
            Device.owner_id == user.id,
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    alert_result = await db.execute(
        select(Alert)
        .where(Alert.device_id == device.id)
        .order_by(Alert.created_at.desc())
        .limit(50)
    )
    recent_alerts = alert_result.scalars().all()

    device_data = {
        "name": device.name,
        "host": device.host,
        "port": device.port,
        "device_type": device.device_type,
        "status": device.status,
        "last_check": (
            device.last_check.isoformat() if device.last_check else None
        ),
        "response_time_ms": device.response_time_ms,
        "tags": device.tags,
    }
    alert_data = [
        {
            "alert_type": a.alert_type,
            "severity": a.severity,
            "title": a.title,
            "resolved": a.resolved,
            "created_at": a.created_at.isoformat(),
        }
        for a in recent_alerts
    ]

    result_data = await analyzer.detect_anomalies(device_data, alert_data)

    anomalies = [
        AnomalyItem(**a) for a in result_data.get("anomalies", [])
    ] if isinstance(result_data.get("anomalies"), list) else []

    return AIAnomalyResponse(
        anomalies=anomalies,
        device_health=result_data.get("device_health", "unknown"),
        summary=result_data.get(
            "summary",
            f"Analyzed {len(alert_data)} recent alerts for {device.name}",
        ),
    )


@router.post("/chat", response_model=AIChatResponse)
async def chat_with_nexus(
    body: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    context = None
    if body.scan_id:
        result = await db.execute(
            select(Scan)
            .options(selectinload(Scan.findings))
            .where(Scan.id == body.scan_id)
        )
        scan = result.scalar_one_or_none()
        if scan and scan.findings:
            context = json.dumps(
                [
                    {
                        "title": f.title,
                        "severity": f.severity,
                        "description": f.description,
                        "remediation": f.remediation,
                    }
                    for f in scan.findings[:10]
                ],
                indent=2,
            )

    response = await analyzer.chat(body.message, context=context)
    return AIChatResponse(response=response)
