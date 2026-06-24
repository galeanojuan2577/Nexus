from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_analyze_scan_no_findings(
    client: AsyncClient, auth_token: str
):
    create_resp = await client.post(
        "/devices/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"name": "AI Test", "host": "example.com", "port": 80},
    )
    device_id = create_resp.json()["id"]

    scan_resp = await client.post(
        "/scans/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"device_id": device_id, "scan_type": "quick"},
    )
    scan_id = scan_resp.json()["id"]

    response = await client.post(
        "/ai/analyze",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"scan_id": scan_id},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["overall_risk"] == "pass"


@pytest.mark.asyncio
async def test_analyze_scan_not_found(
    client: AsyncClient, auth_token: str
):
    response = await client.post(
        "/ai/analyze",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"scan_id": "nonexistent"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_analyze_unauthorized(client: AsyncClient):
    response = await client.post(
        "/ai/analyze",
        json={"scan_id": "test"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_detect_anomalies_device_not_found(
    client: AsyncClient, auth_token: str
):
    response = await client.post(
        "/ai/anomalies",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"device_id": "nonexistent"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_detect_anomalies_unauthorized(client: AsyncClient):
    response = await client.post(
        "/ai/anomalies",
        json={"device_id": "test"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_chat_unauthorized(client: AsyncClient):
    response = await client.post(
        "/ai/chat",
        json={"message": "hello"},
    )
    assert response.status_code == 401
