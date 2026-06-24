from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_device(client: AsyncClient, auth_token: str):
    response = await client.post(
        "/devices/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "name": "Test Server",
            "host": "example.com",
            "port": 443,
            "device_type": "https",
            "tags": "production,web",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Server"
    assert data["host"] == "example.com"
    assert data["status"] == "unknown"


@pytest.mark.asyncio
async def test_list_devices(client: AsyncClient, auth_token: str):
    response = await client.get(
        "/devices/",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_device(client: AsyncClient, auth_token: str):
    create_resp = await client.post(
        "/devices/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"name": "Get Test", "host": "test.local", "port": 80},
    )
    device_id = create_resp.json()["id"]

    response = await client.get(
        f"/devices/{device_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Get Test"


@pytest.mark.asyncio
async def test_update_device(client: AsyncClient, auth_token: str):
    create_resp = await client.post(
        "/devices/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"name": "Update Test", "host": "update.local", "port": 8080},
    )
    device_id = create_resp.json()["id"]

    response = await client.put(
        f"/devices/{device_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"name": "Updated Name"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_delete_device(client: AsyncClient, auth_token: str):
    create_resp = await client.post(
        "/devices/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"name": "Delete Test", "host": "delete.local", "port": 80},
    )
    device_id = create_resp.json()["id"]

    response = await client.delete(
        f"/devices/{device_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_device_unauthorized(client: AsyncClient):
    response = await client.get("/devices/")
    assert response.status_code == 401
