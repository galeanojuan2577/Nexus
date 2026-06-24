from __future__ import annotations

import pytest

from nexus.scanner.engine import ScanEngine


class TestScanEngine:
    def test_calculate_severity_critical(self):
        engine = ScanEngine()
        result = engine._calculate_severity(
            [{"severity": "critical"}, {"severity": "low"}]
        )
        assert result == "critical"

    def test_calculate_severity_high(self):
        engine = ScanEngine()
        result = engine._calculate_severity(
            [{"severity": "high"}, {"severity": "info"}]
        )
        assert result == "high"

    def test_calculate_severity_medium(self):
        engine = ScanEngine()
        result = engine._calculate_severity([{"severity": "medium"}])
        assert result == "medium"

    def test_calculate_severity_low(self):
        engine = ScanEngine()
        result = engine._calculate_severity([{"severity": "low"}])
        assert result == "low"

    def test_calculate_severity_info(self):
        engine = ScanEngine()
        result = engine._calculate_severity(
            [{"severity": "info"}, {"severity": "info"}]
        )
        assert result == "info"

    def test_calculate_severity_pass(self):
        engine = ScanEngine()
        result = engine._calculate_severity([])
        assert result == "pass"

    def test_calculate_score_no_findings(self):
        engine = ScanEngine()
        result = engine._calculate_score([])
        assert result == 100.0

    def test_calculate_score_critical(self):
        engine = ScanEngine()
        result = engine._calculate_score([{"severity": "critical"}])
        assert result == 75.0

    def test_calculate_score_mixed(self):
        engine = ScanEngine()
        result = engine._calculate_score(
            [
                {"severity": "critical"},
                {"severity": "high"},
                {"severity": "medium"},
            ]
        )
        assert result == 50.0

    def test_calculate_score_min_zero(self):
        engine = ScanEngine()
        result = engine._calculate_score(
            [{"severity": "critical"}] * 10
        )
        assert result == 0.0

    def test_calculate_score_unknown_severity(self):
        engine = ScanEngine()
        result = engine._calculate_score([{"severity": "unknown"}])
        assert result == 100.0
