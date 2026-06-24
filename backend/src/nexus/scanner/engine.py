from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from nexus.core.database import async_session
from nexus.models.scan import Finding, Scan
from nexus.scanner.checks import run_all_checks

logger = logging.getLogger(__name__)


class ScanEngine:
    async def run_scan(self, scan_id: str) -> None:
        async with async_session() as db:
            result = await db.execute(
                select(Scan)
                .options(selectinload(Scan.device))
                .where(Scan.id == scan_id)
            )
            scan = result.scalar_one_or_none()
            if not scan:
                logger.error("Scan %s not found", scan_id)
                return

            scan.status = "running"
            scan.started_at = datetime.now(UTC)
            await db.commit()

            try:
                device = scan.device
                target = f"{device.host}:{device.port}" if device.port else device.host

                raw_findings = await run_all_checks(target, scan.scan_type)

                for f in raw_findings:
                    finding = Finding(
                        scan_id=scan.id,
                        check_type=f["check_type"],
                        severity=f["severity"],
                        title=f["title"],
                        description=f.get("description", ""),
                        remediation=f.get("remediation", ""),
                        raw_data=f.get("raw_data"),
                    )
                    db.add(finding)

                severity = self._calculate_severity(raw_findings)
                scan.status = "completed"
                scan.severity = severity
                scan.score = self._calculate_score(raw_findings)
                scan.completed_at = datetime.now(UTC)
                scan.summary = (
                    f"Found {len(raw_findings)} issues. "
                    f"Severity: {severity}. "
                    f"Score: {scan.score:.1f}/100"
                )
                await db.commit()
                logger.info(
                    "Scan %s completed: %d findings, score=%.1f",
                    scan_id,
                    len(raw_findings),
                    scan.score,
                )
            except Exception as e:
                scan.status = "failed"
                scan.completed_at = datetime.now(UTC)
                scan.summary = f"Scan failed: {e}"
                await db.commit()
                logger.error("Scan %s failed: %s", scan_id, e)

    def _calculate_severity(self, findings: list[dict]) -> str:
        severities = {f["severity"] for f in findings}
        if "critical" in severities:
            return "critical"
        if "high" in severities:
            return "high"
        if "medium" in severities:
            return "medium"
        if "low" in severities:
            return "low"
        if "info" in severities:
            return "info"
        return "pass"

    def _calculate_score(self, findings: list[dict]) -> float:
        weights = {"critical": 25, "high": 15, "medium": 10, "low": 5, "info": 1}
        deductions = sum(weights.get(f["severity"], 0) for f in findings)
        return max(0.0, 100.0 - deductions)
