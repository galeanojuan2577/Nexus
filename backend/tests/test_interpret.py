from __future__ import annotations

from nexus.scanner.interpret import interpret_scan


def test_interpret_empty_findings():
    text = interpret_scan(
        [],
        level=1,
        scan_type="quick",
        target="example.com",
        recon_stats=None,
    )
    assert "Qué encontramos" in text
    assert "No apareció ningún problema" in text


def test_interpret_prioritizes_critical():
    findings = [
        {
            "severity": "medium",
            "title": "Medium thing",
            "description": "m",
            "remediation": "fix m",
        },
        {
            "severity": "critical",
            "title": "Critical thing",
            "description": "bad",
            "remediation": "patch now",
            "attack_technique": "T1190",
        },
    ]
    text = interpret_scan(
        findings,
        level=3,
        scan_type="deep",
        target="example.com",
        recon_stats={"subdomains": 2, "live_hosts": 1, "open_ports": 3},
    )
    assert "CRÍTICO" in text
    assert "Critical thing" in text
    assert text.index("Critical thing") < text.index("Medium thing")
    assert "Qué encontré" in text
    assert "Qué hacer" in text
    assert "Subdominios encontrados" in text


def test_interpret_risk_medium():
    text = interpret_scan(
        [{"severity": "medium", "title": "x", "description": "", "remediation": ""}],
        level=2,
        scan_type="normal",
        target="example.com",
    )
    assert "**MEDIO**" in text
