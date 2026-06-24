from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from nexus.scanner.engine import ScanEngine


class TestScanEngineRun:
    async def test_run_scan_not_found(self):
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute.return_value = mock_result

        with patch("nexus.scanner.engine.async_session", return_value=mock_session):
            engine = ScanEngine()
            await engine.run_scan("nonexistent-id")
            mock_session.execute.assert_called_once()

    async def test_run_scan_success(self):
        mock_device = MagicMock()
        mock_device.host = "example.com"
        mock_device.port = 443
        mock_device.name = "test-device"

        mock_scan = MagicMock()
        mock_scan.id = "scan-1"
        mock_scan.device = mock_device
        mock_scan.status = "pending"
        mock_scan.severity = None
        mock_scan.score = None
        mock_scan.started_at = None
        mock_scan.completed_at = None
        mock_scan.summary = None

        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_scan
        mock_session.execute.return_value = mock_result

        with patch("nexus.scanner.engine.async_session", return_value=mock_session):
            with patch("nexus.scanner.engine.run_all_checks", return_value=[]):
                engine = ScanEngine()
                await engine.run_scan("scan-1")

        assert mock_scan.status == "completed"

    async def test_run_scan_failure(self):
        mock_device = MagicMock()
        mock_device.host = "bad-host"
        mock_device.port = 443

        mock_scan = MagicMock()
        mock_scan.id = "scan-2"
        mock_scan.device = mock_device
        mock_scan.status = "pending"
        mock_scan.started_at = None
        mock_scan.completed_at = None
        mock_scan.summary = None

        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_scan
        mock_session.execute.return_value = mock_result

        with patch("nexus.scanner.engine.async_session", return_value=mock_session):
            with patch("nexus.scanner.engine.run_all_checks", side_effect=Exception("Scan crashed")):
                engine = ScanEngine()
                await engine.run_scan("scan-2")

        assert mock_scan.status == "failed"
        assert "Scan crashed" in mock_scan.summary
