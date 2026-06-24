from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_stats(client: AsyncClient, auth_token: str):
    response = await client.get(
        "/dashboard/stats",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_devices" in data
    assert "online_devices" in data
    assert "offline_devices" in data
    assert "total_scans" in data
    assert data["total_devices"] >= 0
