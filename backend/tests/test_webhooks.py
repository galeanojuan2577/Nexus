from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_webhook(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = await client.post(
        "/webhooks/",
        json={
            "name": "Test Slack",
            "provider": "slack",
            "url": "https://hooks.example.com/test",
            "events": "downtime",
        },
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Slack"
    assert data["provider"] == "slack"
    assert data["enabled"] is True


@pytest.mark.asyncio
async def test_list_webhooks(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    await client.post(
        "/webhooks/",
        json={
            "name": "Dev Slack",
            "provider": "slack",
            "url": "https://hooks.example.com/dev",
            "events": "downtime",
        },
        headers=headers,
    )
    response = await client.get("/webhooks/", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Dev Slack"


@pytest.mark.asyncio
async def test_update_webhook(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    create_resp = await client.post(
        "/webhooks/",
        json={
            "name": "Old Name",
            "provider": "slack",
            "url": "https://hooks.example.com/old",
            "events": "downtime",
        },
        headers=headers,
    )
    wh_id = create_resp.json()["id"]
    response = await client.put(
        f"/webhooks/{wh_id}",
        json={"name": "New Name", "enabled": False},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["enabled"] is False


@pytest.mark.asyncio
async def test_delete_webhook(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    create_resp = await client.post(
        "/webhooks/",
        json={
            "name": "To Delete",
            "provider": "telegram",
            "url": "https://api.telegram.org/bot/test",
            "events": "downtime",
        },
        headers=headers,
    )
    wh_id = create_resp.json()["id"]
    response = await client.delete(
        f"/webhooks/{wh_id}", headers=headers
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_webhook_unauthorized(client: AsyncClient):
    response = await client.get("/webhooks/")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_webhook_not_found(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = await client.put(
        "/webhooks/nonexistent-id",
        json={"name": "Nope"},
        headers=headers,
    )
    assert response.status_code == 404
