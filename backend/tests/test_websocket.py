from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

from nexus.services.websocket import ConnectionManager, manager


class TestWebSocket:
    async def test_connect_disconnect(self):
        cm = ConnectionManager()
        ws = AsyncMock()
        await cm.connect(ws, "client-1")
        assert "client-1" in cm._connections
        cm.disconnect("client-1")
        assert "client-1" not in cm._connections

    async def test_broadcast(self):
        cm = ConnectionManager()
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        await cm.connect(ws1, "c1")
        await cm.connect(ws2, "c2")
        await cm.broadcast("test.event", {"key": "value"})
        expected = json.dumps({"event": "test.event", "data": {"key": "value"}})
        ws1.send_text.assert_called_once_with(expected)
        ws2.send_text.assert_called_once_with(expected)

    async def test_broadcast_with_dead_connection(self):
        cm = ConnectionManager()
        good_ws = AsyncMock()
        bad_ws = AsyncMock()
        bad_ws.send_text = AsyncMock(side_effect=Exception("disconnected"))
        await cm.connect(good_ws, "good")
        await cm.connect(bad_ws, "bad")
        await cm.broadcast("test", {"v": 1})
        assert "bad" not in cm._connections
        assert "good" in cm._connections

    async def test_send_personal(self):
        cm = ConnectionManager()
        ws = AsyncMock()
        await cm.connect(ws, "c1")
        await cm.send_personal("evt", {"a": 1}, "c1")
        expected = json.dumps({"event": "evt", "data": {"a": 1}})
        ws.send_text.assert_called_once_with(expected)

    async def test_send_personal_nonexistent(self):
        cm = ConnectionManager()
        await cm.send_personal("evt", {}, "no-such-client")

    async def test_send_personal_failure(self):
        cm = ConnectionManager()
        ws = AsyncMock()
        ws.send_text = AsyncMock(side_effect=Exception("fail"))
        await cm.connect(ws, "c1")
        await cm.send_personal("evt", {}, "c1")
        assert "c1" not in cm._connections

    async def test_manager_singleton(self):
        assert isinstance(manager, ConnectionManager)
