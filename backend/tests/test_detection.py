from __future__ import annotations

from nexus.core.security import hash_password
from nexus.models.alert import Alert
from nexus.models.device import Device
from nexus.models.scan import Finding, Scan
from nexus.models.user import User
from nexus.services.detection import (
    enrich_findings_and_raise_alerts,
    map_finding_to_attack,
)


def _finding(**kwargs) -> Finding:
    defaults = {
        "scan_id": "scan-1",
        "check_type": "sqli",
        "severity": "high",
        "title": "Potential SQL Injection vulnerability",
        "description": "desc",
        "remediation": "fix",
    }
    defaults.update(kwargs)
    return Finding(**defaults)


class TestMapFinding:
    def test_sqli_maps_to_t1190(self):
        m = map_finding_to_attack(_finding())
        assert m is not None
        assert m.technique == "T1190"
        assert m.tactic == "Initial Access"

    def test_cve_maps_to_t1190(self):
        m = map_finding_to_attack(_finding(check_type="cve_detection"))
        assert m is not None
        assert m.technique == "T1190"

    def test_exposed_env_maps_to_credential_access(self):
        m = map_finding_to_attack(
            _finding(
                check_type="exposed_endpoints",
                title="Exposed endpoint: /.env",
                raw_data="{'path': '/.env', 'status': 200}",
            )
        )
        assert m is not None
        assert m.technique == "T1552.001"
        assert m.tactic == "Credential Access"

    def test_missing_hsts_maps_to_t1557(self):
        m = map_finding_to_attack(
            _finding(
                check_type="security_headers",
                title="Missing Strict-Transport-Security",
                raw_data="{'missing_header': 'strict-transport-security'}",
            )
        )
        assert m is not None
        assert m.technique == "T1557"

    def test_security_headers_without_known_header_returns_none(self):
        m = map_finding_to_attack(
            _finding(
                check_type="security_headers",
                raw_data="{'missing_header': 'x-foo'}",
            )
        )
        assert m is None

    def test_technology_maps_to_recon(self):
        m = map_finding_to_attack(
            _finding(check_type="technology_detection", severity="info")
        )
        assert m is not None
        assert m.technique == "T1595"

    def test_unknown_check_type_returns_none(self):
        m = map_finding_to_attack(_finding(check_type="unknown_type"))
        assert m is None


class TestEnrich:
    async def test_enrich_creates_alert_and_columns(self, db_session):
        user = User(
            email="soc@example.com",
            name="SOC",
            hashed_password=hash_password("test123456"),
            role="analyst",
        )
        db_session.add(user)
        await db_session.commit()

        device = Device(name="lab", host="example.com", port=80, owner_id=user.id)
        db_session.add(device)
        await db_session.commit()

        scan = Scan(
            device_id=device.id,
            scan_type="full",
            status="completed",
            severity="high",
            score=50.0,
            created_by_id=user.id,
        )
        db_session.add(scan)
        await db_session.commit()

        finding = Finding(
            scan_id=scan.id,
            check_type="sqli",
            severity="high",
            title="Potential SQL Injection vulnerability",
            description="payload triggered error",
            remediation="parameterized queries",
        )
        db_session.add(finding)
        await db_session.commit()

        detections = await enrich_findings_and_raise_alerts(scan.id, db=db_session)
        assert len(detections) == 1
        assert detections[0]["technique"] == "T1190"

        await db_session.refresh(finding)
        assert finding.attack_technique == "T1190"
        assert finding.attack_tactic == "Initial Access"

        from sqlalchemy import select

        alerts = (
            await db_session.execute(select(Alert).where(Alert.device_id == device.id))
        ).scalars().all()
        assert len(alerts) == 1
        assert "T1190" in alerts[0].title
        assert alerts[0].alert_type == "detection"

    async def test_enrich_missing_scan_returns_empty(self, db_session):
        detections = await enrich_findings_and_raise_alerts(
            "does-not-exist", db=db_session
        )
        assert detections == []
