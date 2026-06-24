from __future__ import annotations

import asyncio
import logging
import time
from datetime import UTC, datetime

import httpx
from sqlalchemy import select

from nexus.core.database import async_session
from nexus.models.alert import Alert
from nexus.models.device import Device
from nexus.models.webhook import Webhook
from nexus.services.webhook import fire_webhook, matches_event
from nexus.services.websocket import manager

logger = logging.getLogger(__name__)


class MonitorEngine:
    def __init__(self, interval: int = 60):
        self.interval = interval
        self._running = False

    async def start(self) -> None:
        self._running = True
        logger.info(
            "Monitor engine started (interval=%ds)", self.interval
        )
        while self._running:
            await self._check_all_devices()
            await asyncio.sleep(self.interval)

    async def stop(self) -> None:
        self._running = False
        logger.info("Monitor engine stopped")

    async def _check_all_devices(self) -> None:
        async with async_session() as db:
            result = await db.execute(select(Device))
            devices = result.scalars().all()
            for device in devices:
                await self._check_device(device, db)
            await db.commit()

    async def _check_device(self, device: Device, db: async_session) -> None:
        start = time.monotonic()
        try:
            if device.device_type == "ping":
                status = await self._ping_check(device.host)
            elif device.device_type == "tcp":
                status = await self._tcp_check(device.host, device.port)
            else:
                status = await self._http_check(
                    device.host, device.port, device.device_type
                )
            elapsed = (time.monotonic() - start) * 1000
            previous = device.status
            device.status = "online" if status else "offline"
            device.last_check = datetime.now(UTC)
            device.response_time_ms = round(elapsed, 2)
            if previous == "online" and device.status == "offline":
                alert = Alert(
                    device_id=device.id,
                    alert_type="downtime",
                    severity="critical",
                    title=f"Device {device.name} is DOWN",
                    message=(
                        f"Device {device.name} ({device.host}:{device.port}) "
                        f"became unreachable"
                    ),
                )
                db.add(alert)
                await db.flush()
                await manager.broadcast("alert.new", {
                    "id": alert.id,
                    "device_id": alert.device_id,
                    "alert_type": alert.alert_type,
                    "severity": alert.severity,
                    "title": alert.title,
                    "device_name": device.name,
                })
                await self._fire_alert_webhooks(device, alert, db)
                logger.warning("ALERT: %s is DOWN", device.name)
        except Exception as e:
            device.status = "offline"
            device.last_check = datetime.now(UTC)
            logger.error("Monitor check failed for %s: %s", device.name, e)

    async def _fire_alert_webhooks(
        self, device: Device, alert: Alert, db: async_session
    ) -> None:
        result = await db.execute(
            select(Webhook).where(
                Webhook.user_id == device.owner_id,
                Webhook.enabled.is_(True),
            )
        )
        webhooks = result.scalars().all()
        payload = {
            "title": alert.title,
            "message": alert.message or "",
            "severity": alert.severity,
            "alert_type": alert.alert_type,
            "device_name": device.name,
            "host": device.host,
        }
        for wh in webhooks:
            if matches_event(wh.events, alert.alert_type):
                await fire_webhook(wh.provider, wh.url, payload)

    async def _http_check(self, host: str, port: int, scheme: str) -> bool:
        url = f"{scheme}://{host}:{port}"
        async with httpx.AsyncClient(timeout=10, verify=False) as client:
            response = await client.get(url)
            return response.status_code < 500

    async def _ping_check(self, host: str) -> bool:
        proc = await asyncio.create_subprocess_exec(
            "ping", "-c", "1", "-W", "5", host,
            stdout=asyncio.DEVNULL,
            stderr=asyncio.DEVNULL,
        )
        return await proc.wait() == 0

    async def _tcp_check(self, host: str, port: int) -> bool:
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=10
            )
            writer.close()
            await writer.wait_closed()
            return True
        except (TimeoutError, OSError):
            return False
