from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from nexus.services.websocket import manager

router = APIRouter()


@router.websocket("/ws/{client_id}")
async def websocket_endpoint(ws: WebSocket, client_id: str):
    await manager.connect(ws, client_id)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(client_id)
