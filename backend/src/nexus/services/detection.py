from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from nexus.core.database import async_session
from nexus.models.alert import Alert
from nexus.models.scan import Finding, Scan

logger = logging.getLogger(__name__)

ALERT_SEVERITIES = {"critical", "high"}

_EXPLOIT_PUBLIC = "Exploit Public-Facing Application"


@dataclass(frozen=True)
class AttackMapping:
    technique: str
    tactic_id: str
    tactic: str
    name: str


CHECK_TYPE_MAP: dict[str, AttackMapping] = {
    "sqli": AttackMapping("T1190", "TA0001", "Initial Access", _EXPLOIT_PUBLIC),
    "cve_detection": AttackMapping("T1190", "TA0001", "Initial Access", _EXPLOIT_PUBLIC),
    "exposed_endpoints": AttackMapping(
        "T1552.001",
        "TA0006",
        "Credential Access",
        "Unsecured Credentials: Credentials In Files",
    ),
    "info_disclosure": AttackMapping(
        "T1592",
        "TA0043",
        "Reconnaissance",
        "Gather Victim Host Information",
    ),
    "technology_detection": AttackMapping(
        "T1595", "TA0043", "Reconnaissance", "Active Scanning"
    ),
    "security_headers": AttackMapping(
        "T1557", "TA0001", "Initial Access", "Adversary-in-the-Middle"
    ),
}

SENSITIVE_PATH_MAP: dict[str, AttackMapping] = {
    "/.env": AttackMapping(
        "T1552.001",
        "TA0006",
        "Credential Access",
        "Unsecured Credentials: Credentials In Files",
    ),
    "/.git/config": AttackMapping(
        "T1213", "TA0009", "Collection", "Data from Information Repositories"
    ),
    "/phpinfo.php": AttackMapping(
        "T1082", "TA0007", "Discovery", "System Information Discovery"
    ),
    "/config": AttackMapping(
        "T1552.001",
        "TA0006",
        "Credential Access",
        "Unsecured Credentials: Credentials In Files",
    ),
    "/backup": AttackMapping(
        "T1005", "TA0009", "Collection", "Data from Local System"
    ),
    "/debug": AttackMapping(
        "T1552.001",
        "TA0006",
        "Credential Access",
        "Unsecured Credentials: Credentials In Files",
    ),
    "/logs": AttackMapping(
        "T1005", "TA0009", "Collection", "Data from Local System"
    ),
    "/server-status": AttackMapping(
        "T1046", "TA0007", "Discovery", "Network Service Discovery"
    ),
}


def map_finding_to_attack(finding: Finding) -> AttackMapping | None:
    if finding.check_type == "exposed_endpoints" and finding.raw_data:
        for path, mapping in SENSITIVE_PATH_MAP.items():
            if path in finding.raw_data:
                return mapping
    if finding.check_type == "security_headers" and finding.raw_data:
        if "strict-transport-security" in finding.raw_data:
            return CHECK_TYPE_MAP["security_headers"]
        if "content-security-policy" in finding.raw_data:
            return CHECK_TYPE_MAP["security_headers"]
        return None
    return CHECK_TYPE_MAP.get(finding.check_type)


async def _enrich_with_session(
    db: AsyncSession, scan_id: str
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Scan)
        .options(selectinload(Scan.findings), selectinload(Scan.device))
        .where(Scan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        logger.warning("Detection: scan %s not found", scan_id)
        return []

    detections: list[dict[str, Any]] = []
    for finding in scan.findings:
        mapping = map_finding_to_attack(finding)
        if not mapping:
            continue
        finding.attack_technique = mapping.technique
        finding.attack_tactic = mapping.tactic
        finding.attack_tactic_id = mapping.tactic_id
        detections.append(
            {
                "finding_id": finding.id,
                "title": finding.title,
                "severity": finding.severity,
                "technique": mapping.technique,
                "technique_name": mapping.name,
                "tactic": mapping.tactic,
                "tactic_id": mapping.tactic_id,
            }
        )
        if finding.severity in ALERT_SEVERITIES:
            db.add(
                Alert(
                    device_id=scan.device_id,
                    alert_type="detection",
                    severity=finding.severity,
                    title=f"[{mapping.technique}] {finding.title}",
                    message=(
                        f"{finding.description or ''} | "
                        f"ATT&CK {mapping.technique} ({mapping.name}) | "
                        f"Tactic: {mapping.tactic} | "
                        f"Remediation: {finding.remediation or 'n/a'}"
                    ),
                    resolved=False,
                )
            )
    await db.commit()
    logger.info(
        "Detection: scan %s → %d techniques mapped", scan_id, len(detections)
    )
    return detections


async def enrich_findings_and_raise_alerts(
    scan_id: str, db: AsyncSession | None = None
) -> list[dict[str, Any]]:
    if db is not None:
        return await _enrich_with_session(db, scan_id)
    async with async_session() as session:
        return await _enrich_with_session(session, scan_id)
