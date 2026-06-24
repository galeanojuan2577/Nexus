from __future__ import annotations

from httpx import AsyncClient


class TestScansAPI:
    async def test_list_scans_pagination(self, client: AsyncClient, auth_token: str):
        resp = await client.get(
            "/scans/?skip=0&limit=10",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_list_scans_search(self, client: AsyncClient, auth_token: str):
        resp = await client.get(
            "/scans/?search=test",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code in (200, 404)


class TestWebhooksAPI:
    async def test_list_webhooks_pagination(self, client: AsyncClient, auth_token: str):
        resp = await client.get(
            "/webhooks/?skip=0&limit=10",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200

    async def test_update_webhook_nonexistent(self, client: AsyncClient, auth_token: str):
        resp = await client.put(
            "/webhooks/9999",
            json={"name": "test"},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 404

    async def test_delete_webhook_nonexistent(self, client: AsyncClient, auth_token: str):
        resp = await client.delete(
            "/webhooks/9999",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 404


class TestAuthAPI:
    async def test_me_unauthorized(self, client: AsyncClient):
        resp = await client.get("/auth/me")
        assert resp.status_code in (401, 403)

    async def test_login_invalid_email(self, client: AsyncClient):
        resp = await client.post(
            "/auth/login",
            json={"email": "not@valid", "password": "short"},
        )
        assert resp.status_code == 422


class TestDashboardAPI:
    async def test_dashboard_unauthorized(self, client: AsyncClient):
        resp = await client.get("/dashboard/stats")
        assert resp.status_code in (401, 403)

    async def test_dashboard_authenticated(self, client: AsyncClient, auth_token: str):
        resp = await client.get(
            "/dashboard/stats",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_devices" in data
        assert "total_scans" in data
