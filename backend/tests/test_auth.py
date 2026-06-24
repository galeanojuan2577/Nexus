from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_forgot_password_nonexistent(client: AsyncClient):
    response = await client.post(
        "/auth/forgot-password",
        json={"email": "nonexistent@example.com"},
    )
    assert response.status_code == 200
    assert "message" in response.json()


@pytest.mark.asyncio
async def test_forgot_password_and_reset(client: AsyncClient, test_user):
    forgot = await client.post(
        "/auth/forgot-password",
        json={"email": "test@example.com"},
    )
    data = forgot.json()
    assert "reset_token" in data
    token = data["reset_token"]

    response = await client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "newpass123"},
    )
    assert response.status_code == 200

    login = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "newpass123"},
    )
    assert login.status_code == 200
    assert "access_token" in login.json()


@pytest.mark.asyncio
async def test_reset_password_invalid_token(client: AsyncClient):
    response = await client.post(
        "/auth/reset-password",
        json={"token": "invalid-token", "new_password": "newpass123"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_reset_password_expired_token(client: AsyncClient, test_user, db_session):
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import select

    from nexus.models.password_reset import PasswordResetToken

    forgot = await client.post(
        "/auth/forgot-password",
        json={"email": "test@example.com"},
    )
    token = forgot.json()["reset_token"]

    result = await db_session.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == token
        )
    )
    reset = result.scalar_one()
    reset.expires_at = datetime.now(UTC) - timedelta(hours=1)
    await db_session.commit()

    response = await client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "newpass123"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    response = await client.post(
        "/auth/register",
        json={
            "email": "new@example.com",
            "name": "New User",
            "password": "password123",
            "role": "analyst",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient, test_user):
    response = await client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "name": "Duplicate",
            "password": "password123",
        },
    )
    assert response.status_code == 409
    assert "already registered" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login(client: AsyncClient, test_user):
    response = await client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "test123456"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_invalid(client: AsyncClient):
    response = await client.post(
        "/auth/login",
        json={            "email": "wrong@example.com", "password": "wrongpass"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, auth_token: str):
    response = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["role"] == "admin"
