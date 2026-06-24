from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


async def send_slack(url: str, payload: dict[str, Any]) -> bool:
    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": payload["title"]},
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": payload.get("message", "")},
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": (
                        f"*Severity:* {payload.get('severity', 'N/A')} "
                        f"| *Type:* {payload.get('alert_type', 'N/A')}"
                    ),
                }
            ],
        },
    ]
    if payload.get("device_name"):
        blocks.append(
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Device:* {payload['device_name']}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Host:* {payload.get('host', 'N/A')}",
                    },
                ],
            }
        )
    body = {"text": payload["title"], "blocks": blocks}
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            resp = await c.post(url, json=body)
            resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Slack webhook failed: %s", e)
        return False


async def send_telegram(url: str, payload: dict[str, Any]) -> bool:
    text = (
        f"*{payload['title']}*\n"
        f"{payload.get('message', '')}\n\n"
        f"Severity: {payload.get('severity', 'N/A')} | "
        f"Type: {payload.get('alert_type', 'N/A')}"
    )
    if payload.get("device_name"):
        text += f"\nDevice: {payload['device_name']} ({payload.get('host', 'N/A')})"
    body = {
        "chat_id": payload.get("chat_id"),
        "text": text,
        "parse_mode": "Markdown",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            resp = await c.post(url, json=body)
            resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Telegram webhook failed: %s", e)
        return False


async def send_email(url: str, payload: dict[str, Any]) -> bool:
    body = {
        "to": payload.get("to"),
        "subject": payload["title"],
        "text": (
            f"{payload.get('message', '')}\n\n"
            f"Severity: {payload.get('severity', 'N/A')}\n"
            f"Type: {payload.get('alert_type', 'N/A')}\n"
            f"Device: {payload.get('device_name', 'N/A')}"
        ),
    }
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            resp = await c.post(url, json=body)
            resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Email webhook failed: %s", e)
        return False


DISPATCH: dict[str, Any] = {
    "slack": send_slack,
    "telegram": send_telegram,
    "email": send_email,
}


async def fire_webhook(
    provider: str, url: str, payload: dict[str, Any]
) -> bool:
    sender = DISPATCH.get(provider)
    if not sender:
        logger.warning("Unknown webhook provider: %s", provider)
        return False
    return await sender(url, payload)


def matches_event(webhook_events: str, event: str) -> bool:
    return event in [e.strip() for e in webhook_events.split(",")]
