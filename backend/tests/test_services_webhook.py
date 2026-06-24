from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from nexus.services.webhook import (
    fire_webhook,
    matches_event,
    send_email,
    send_slack,
    send_telegram,
)


class TestWebhookService:
    async def test_send_slack_success(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200)
        result = await send_slack(
            "https://hooks.slack.com/test",
            {
                "title": "Test Alert",
                "message": "Something happened",
                "severity": "critical",
                "alert_type": "downtime",
                "device_name": "server-1",
                "host": "10.0.0.1",
            },
        )
        assert result is True

    async def test_send_slack_failure(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=500)
        result = await send_slack(
            "https://hooks.slack.com/test",
            {"title": "Test", "message": "fail"},
        )
        assert result is False

    async def test_send_slack_no_device(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200)
        result = await send_slack(
            "https://hooks.slack.com/test",
            {"title": "Test", "message": "no device"},
        )
        assert result is True

    async def test_send_telegram_success(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200)
        result = await send_telegram(
            "https://api.telegram.org/bot/test",
            {
                "title": "Alert",
                "message": "down",
                "severity": "high",
                "alert_type": "downtime",
                "device_name": "web-01",
                "host": "web.example.com",
            },
        )
        assert result is True

    async def test_send_telegram_failure(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=400)
        result = await send_telegram(
            "https://api.telegram.org/bot/test",
            {"title": "Alert", "message": "fail"},
        )
        assert result is False

    async def test_send_email_success(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200)
        result = await send_email(
            "https://api.email.com/send",
            {
                "title": "Test",
                "message": "body",
                "severity": "low",
                "alert_type": "info",
                "device_name": "db-01",
                "to": "admin@example.com",
            },
        )
        assert result is True

    async def test_send_email_failure(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=500)
        result = await send_email(
            "https://api.email.com/send",
            {"title": "Test", "to": "admin@example.com"},
        )
        assert result is False

    async def test_fire_webhook_unknown_provider(self):
        result = await fire_webhook("unknown", "http://example.com", {})
        assert result is False

    async def test_fire_webhook_slack(self, httpx_mock: HTTPXMock):
        httpx_mock.add_response(status_code=200)
        result = await fire_webhook(
            "slack",
            "https://hooks.slack.com/test",
            {"title": "Test"},
        )
        assert result is True

    async def test_matches_event_single(self):
        assert matches_event("downtime", "downtime") is True

    async def test_matches_event_multiple(self):
        assert matches_event("downtime,alert", "alert") is True

    async def test_matches_event_not_found(self):
        assert matches_event("downtime,alert", "recovery") is False

    async def test_matches_event_empty(self):
        assert matches_event("", "downtime") is False
