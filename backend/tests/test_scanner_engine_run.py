from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from nexus.scanner.engine import ScanEngine


def _mock_scan(scan_id: str = "scan-1", **kwargs):
    mock_device = MagicMock()
    mock_device.host = kwargs.get("host", "example.com")
    mock_device.port = kwargs.get("port", 443)
    mock_device.name = "test-device"

    mock_scan = MagicMock()
    mock_scan.id = scan_id
    mock_scan.device = mock_device
    mock_scan.status = kwargs.get("status", "pending")
    mock_scan.scan_type = kwargs.get("scan_type", "quick")
    mock_scan.level = kwargs.get("level", 1)
    mock_scan.severity = None
    mock_scan.score = None
    mock_scan.progress = 0
    mock_scan.stage = None
    mock_scan.interpretation = None
    mock_scan.error = None
    mock_scan.started_at = None
    mock_scan.completed_at = None
    mock_scan.summary = None
    return mock_scan


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
        mock_scan = _mock_scan()
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session

        scan_result = MagicMock()
        scan_result.scalar_one_or_none.return_value = mock_scan
        findings_result = MagicMock()
        findings_result.scalars.return_value.all.return_value = []

        mock_session.execute = AsyncMock(
            side_effect=[scan_result, findings_result]
        )

        with (
            patch("nexus.scanner.engine.async_session", return_value=mock_session),
            patch(
                "nexus.scanner.engine.run_all_checks",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "nexus.scanner.engine.run_host_recon",
                new_callable=AsyncMock,
                return_value=([], {"skipped": True}),
            ),
            patch(
                "nexus.scanner.engine.enrich_findings_and_raise_alerts",
                new_callable=AsyncMock,
            ),
        ):
            engine = ScanEngine()
            await engine.run_scan("scan-1")

        assert mock_scan.status == "completed"
        assert mock_scan.progress == 100
        assert mock_scan.interpretation

    async def test_run_scan_failure(self):
        mock_scan = _mock_scan(scan_id="scan-2", host="bad-host")
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_scan
        mock_session.execute.return_value = mock_result

        with (
            patch("nexus.scanner.engine.async_session", return_value=mock_session),
            patch(
                "nexus.scanner.engine.run_all_checks",
                new_callable=AsyncMock,
                side_effect=Exception("Scan crashed"),
            ),
        ):
            engine = ScanEngine()
            await engine.run_scan("scan-2")

        assert mock_scan.status == "failed"
        assert "Scan crashed" in mock_scan.summary

    async def test_run_scan_cancelled(self):
        mock_scan = _mock_scan(scan_id="scan-3", status="running")
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = mock_session
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_scan
        mock_session.execute.return_value = mock_result

        with (
            patch("nexus.scanner.engine.async_session", return_value=mock_session),
            patch(
                "nexus.scanner.engine.run_all_checks",
                new_callable=AsyncMock,
                side_effect=asyncio.CancelledError(),
            ),
        ):
            engine = ScanEngine()
            with pytest.raises(asyncio.CancelledError):
                await engine.run_scan("scan-3")

        assert mock_scan.status == "cancelled"
