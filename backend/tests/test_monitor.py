from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
from pytest_httpx import HTTPXMock

from nexus.monitor.engine import MonitorEngine


class TestMonitorEngine:
    async def test_start_stop(self):
        engine = MonitorEngine(interval=1)
        await engine.stop()
        assert engine._running is False

    async def test_stop(self):
        engine = MonitorEngine(interval=1)
        engine._running = True
        await engine.stop()
        assert engine._running is False

    async def test_http_check_success(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200)
        engine = MonitorEngine()
        result = await engine._http_check("example.com", 80, "http")
        assert result is True

    async def test_http_check_failure(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=500)
        engine = MonitorEngine()
        result = await engine._http_check("example.com", 80, "http")
        assert result is False

    async def test_ping_check_success(self):
        engine = MonitorEngine()
        mock_proc = MagicMock()
        mock_proc.wait = AsyncMock(return_value=0)
        with patch("nexus.monitor.engine.asyncio.create_subprocess_exec", return_value=mock_proc):
            result = await engine._ping_check("127.0.0.1")
            assert result is True

    async def test_ping_check_failure(self):
        engine = MonitorEngine()
        mock_proc = MagicMock()
        mock_proc.wait = AsyncMock(return_value=1)
        with patch("nexus.monitor.engine.asyncio.create_subprocess_exec", return_value=mock_proc):
            result = await engine._ping_check("127.0.0.1")
            assert result is False

    async def test_tcp_check_success(self):
        engine = MonitorEngine()
        mock_writer = MagicMock()
        mock_writer.wait_closed = AsyncMock(return_value=None)
        with patch("nexus.monitor.engine.asyncio.open_connection", return_value=(None, mock_writer)):
            result = await engine._tcp_check("127.0.0.1", 80)
            assert result is True

    async def test_tcp_check_timeout(self):
        engine = MonitorEngine()
        with patch("nexus.monitor.engine.asyncio.open_connection", side_effect=TimeoutError("timeout")):
            result = await engine._tcp_check("127.0.0.1", 80)
            assert result is False

    async def test_tcp_check_oserror(self):
        engine = MonitorEngine()
        with patch("nexus.monitor.engine.asyncio.open_connection", side_effect=OSError("refused")):
            result = await engine._tcp_check("127.0.0.1", 80)
            assert result is False

    def _device(self, **kw):
        d = MagicMock()
        for k in ("status", "tags", "response_time_ms", "last_check", "port", "owner_id"):
            setattr(d, k, None)
        d.port = 0
        d.status = "unknown"
        d.tags = None
        d.response_time_ms = None
        d.last_check = None
        d.owner_id = None
        for k, v in kw.items():
            setattr(d, k, v)
        return d

    async def test_check_device_ping(self):
        engine = MonitorEngine()
        device = self._device(device_type="ping", host="127.0.0.1", name="ping-device")
        mock_db = AsyncMock()
        mock_proc = MagicMock()
        mock_proc.wait = AsyncMock(return_value=0)
        with patch("nexus.monitor.engine.asyncio.create_subprocess_exec", return_value=mock_proc):
            await engine._check_device(device, mock_db)
        assert device.status == "online"

    async def test_check_device_tcp(self):
        engine = MonitorEngine()
        device = self._device(device_type="tcp", host="127.0.0.1", port=80, name="tcp-device")
        mock_db = AsyncMock()
        mock_writer = MagicMock()
        mock_writer.wait_closed = AsyncMock(return_value=None)
        with patch("nexus.monitor.engine.asyncio.open_connection", return_value=(None, mock_writer)):
            await engine._check_device(device, mock_db)
        assert device.status == "online"

    async def test_check_device_http(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200)
        engine = MonitorEngine()
        device = self._device(device_type="https", host="example.com", port=443, name="web-device")
        mock_db = AsyncMock()
        await engine._check_device(device, mock_db)
        assert device.status == "online"

    async def test_check_device_exception(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=503)
        engine = MonitorEngine()
        device = self._device(device_type="https", host="bad-host", port=443, name="broken-device")
        mock_db = AsyncMock()
        await engine._check_device(device, mock_db)
        assert device.status == "offline"

    async def test_fire_alert_webhooks(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200)
        engine = MonitorEngine()
        device = self._device(name="test-host", host="10.0.0.1", owner_id="user-1")
        alert = MagicMock()
        alert.title = "DOWN"
        alert.message = "Device is down"
        alert.severity = "critical"
        alert.alert_type = "downtime"

        mock_db = AsyncMock()
        mock_wh = MagicMock()
        mock_wh.events = "downtime"
        mock_wh.provider = "slack"
        mock_wh.url = "https://hooks.slack.com/test"
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_wh]
        mock_db.execute.return_value = mock_result

        await engine._fire_alert_webhooks(device, alert, mock_db)
        assert mock_db.execute.called
