from __future__ import annotations

from httpx import AsyncClient

from nexus.core.security import hash_password
from nexus.models.device import Device
from nexus.models.scan import Scan
from nexus.models.user import User


class TestAlerts:
    async def test_list_alerts_empty(self, client: AsyncClient, auth_token: str):
        resp = await client.get("/alerts/", headers={"Authorization": f"Bearer {auth_token}"})
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_alerts_unauthorized(self, client: AsyncClient):
        resp = await client.get("/alerts/")
        assert resp.status_code in (401, 403)

    async def test_resolve_nonexistent(self, client: AsyncClient, auth_token: str):
        resp = await client.put(
            "/alerts/9999/resolve",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 404


class TestScansDetail:
    async def test_get_scan_detail_not_found(self, client: AsyncClient, auth_token: str):
        resp = await client.get(
            "/scans/9999", headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 404

    async def test_get_scan_detail_unauthorized(self, client: AsyncClient):
        resp = await client.get("/scans/some-id")
        assert resp.status_code in (401, 403)

    async def test_get_scan_report_not_found(self, client: AsyncClient, auth_token: str):
        resp = await client.get(
            "/scans/9999/report",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 404


class TestProbe:
    async def test_probe_empty_host(self, client: AsyncClient, auth_token: str):
        resp = await client.post(
            "/devices/probe",
            json={"host": ""},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200

    async def test_probe_unauthorized(self, client: AsyncClient):
        resp = await client.post("/devices/probe", json={"host": "example.com"})
        assert resp.status_code in (401, 403)


class TestDeviceDetail:
    async def test_get_nonexistent(self, client: AsyncClient, auth_token: str):
        resp = await client.get(
            "/devices/9999", headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert resp.status_code == 404

    async def test_update_device(self, client: AsyncClient, auth_token: str, test_user: User):
        resp = await client.post(
            "/devices/",
            json={"name": "original", "host": "test.com", "port": 80, "device_type": "http"},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 201
        device_id = resp.json()["id"]

        resp = await client.put(
            f"/devices/{device_id}",
            json={"name": "updated"},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "updated"

    async def test_update_nonexistent(self, client: AsyncClient, auth_token: str):
        resp = await client.put(
            "/devices/9999",
            json={"name": "test"},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 404

    async def test_delete_nonexistent(self, client: AsyncClient, auth_token: str):
        resp = await client.delete(
            "/devices/9999",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 404

    async def test_device_search(self, client: AsyncClient, auth_token: str):
        resp = await client.post(
            "/devices/",
            json={"name": "findme", "host": "search.com", "port": 443, "device_type": "https"},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 201

        resp = await client.get(
            "/devices/?search=findme",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
