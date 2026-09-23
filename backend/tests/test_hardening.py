from __future__ import annotations

import pytest
from httpx import AsyncClient
from pydantic import ValidationError


@pytest.mark.asyncio
async def test_metrics_open_when_no_token(client: AsyncClient):
    from nexus.core.config import settings

    old = settings.metrics_token
    settings.metrics_token = ""
    try:
        resp = await client.get("/metrics")
        assert resp.status_code == 200
    finally:
        settings.metrics_token = old


@pytest.mark.asyncio
async def test_metrics_requires_token_when_set(client: AsyncClient):
    from nexus.core.config import settings

    old = settings.metrics_token
    settings.metrics_token = "secret-metrics"
    try:
        resp = await client.get("/metrics")
        assert resp.status_code == 401

        resp = await client.get(
            "/metrics", headers={"Authorization": "Bearer secret-metrics"}
        )
        assert resp.status_code == 200

        resp = await client.get("/metrics", headers={"Authorization": "Bearer wrong"})
        assert resp.status_code == 401
    finally:
        settings.metrics_token = old


def test_cors_wildcard_rejected(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "x" * 32)
    monkeypatch.setenv("CORS_ORIGINS", "*")
    from nexus.core.config import Settings

    with pytest.raises(ValidationError) as exc:
        Settings()
    assert "CORS" in str(exc.value) or "wildcard" in str(exc.value)
