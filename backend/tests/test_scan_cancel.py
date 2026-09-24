from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from nexus.models.scan import Scan


async def _create_device(client: AsyncClient, token: str) -> str:
    resp = await client.post(
        "/devices/",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Cancel Target", "host": "example.com", "port": 443},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_create_scan_with_level(client: AsyncClient, auth_token: str):
    device_id = await _create_device(client, auth_token)
    resp = await client.post(
        "/scans/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"device_id": device_id, "scan_type": "deep", "level": 3},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["scan_type"] == "deep"
    assert data["level"] == 3
    assert data["progress"] == 0
    assert data["status"] in ("pending", "running")

    await asyncio.sleep(0.05)
    cancel = await client.post(
        f"/scans/{data['id']}/cancel",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert cancel.status_code in (200, 409)
    if cancel.status_code == 200:
        assert cancel.json()["status"] in (
            "cancelled",
            "completed",
            "failed",
            "running",
        )


@pytest.mark.asyncio
async def test_cancel_completed_scan_conflict(
    client: AsyncClient, auth_token: str, db_session
):
    device_id = await _create_device(client, auth_token)
    resp = await client.post(
        "/scans/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"device_id": device_id, "scan_type": "headers"},
    )
    scan_id = resp.json()["id"]
    await asyncio.sleep(0.05)

    result = await db_session.execute(select(Scan).where(Scan.id == scan_id))
    scan = result.scalar_one()
    if scan.status in ("pending", "running"):
        scan.status = "completed"
        await db_session.commit()

    cancel = await client.post(
        f"/scans/{scan_id}/cancel",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert cancel.status_code == 409


@pytest.mark.asyncio
async def test_scan_detail_returns_progress_fields(
    client: AsyncClient, auth_token: str
):
    device_id = await _create_device(client, auth_token)
    resp = await client.post(
        "/scans/",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={"device_id": device_id, "scan_type": "quick"},
    )
    scan_id = resp.json()["id"]
    await asyncio.sleep(0.05)
    detail = await client.get(
        f"/scans/{scan_id}",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert detail.status_code == 200
    body = detail.json()
    assert "progress" in body
    assert "stage" in body
    assert "level" in body
    assert "interpretation" in body
