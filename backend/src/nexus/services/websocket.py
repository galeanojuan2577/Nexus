from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, ws: WebSocket, client_id: str) -> None:
        await ws.accept()
        self._connections[client_id] = ws
        logger.info("WebSocket connected: %s", client_id)

    def disconnect(self, client_id: str) -> None:
        self._connections.pop(client_id, None)
        logger.info("WebSocket disconnected: %s", client_id)

    async def broadcast(self, event: str, data: dict[str, Any]) -> None:
        message = json.dumps({"event": event, "data": data})
        dead: list[str] = []
        for client_id, ws in self._connections.items():
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(client_id)
        for cid in dead:
            self.disconnect(cid)

    async def send_personal(
        self, event: str, data: dict[str, Any], client_id: str
    ) -> None:
        ws = self._connections.get(client_id)
        if ws:
            try:
                await ws.send_text(json.dumps({"event": event, "data": data}))
            except Exception:
                self.disconnect(client_id)


manager = ConnectionManager()
