from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_scan(client: AsyncClient, auth_token: str):
    device_resp = await client.post(
        "/devices/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"name": "Scan Target", "host": "scan-test.local", "port": 80},
    )
    device_id = device_resp.json()["id"]

    response = await client.post(
        "/scans/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"device_id": device_id, "scan_type": "quick"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["scan_type"] == "quick"


@pytest.mark.asyncio
async def test_list_scans(client: AsyncClient, auth_token: str):
    response = await client.get(
        "/scans/",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_scan_report_pdf(client: AsyncClient, auth_token: str):
    device_resp = await client.post(
        "/devices/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"name": "Report Target", "host": "report-test.local", "port": 80},
    )
    scan_resp = await client.post(
        "/scans/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"device_id": device_resp.json()["id"], "scan_type": "quick"},
    )
    scan_id = scan_resp.json()["id"]

    response = await client.get(
        f"/scans/{scan_id}/report",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_scan_log_endpoint(client: AsyncClient, auth_token: str):
    device_resp = await client.post(
        "/devices/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"name": "Log Target", "host": "log-test.local", "port": 80},
    )
    scan_resp = await client.post(
        "/scans/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"device_id": device_resp.json()["id"], "scan_type": "quick"},
    )
    scan_id = scan_resp.json()["id"]

    response = await client.get(
        f"/scans/{scan_id}/log",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scan_id"] == scan_id
    assert "lines" in data
    assert isinstance(data["lines"], list)
