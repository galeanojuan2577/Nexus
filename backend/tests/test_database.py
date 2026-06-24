from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from nexus.core.database import init_db
from nexus.core.security import decode_access_token, hash_password, require_role, verify_password


class TestDatabase:
    async def test_init_db_creates_tables(self, engine):
        async with engine.begin() as conn:
            result = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            )
            tables = {row[0] for row in result}
            assert "users" in tables

    async def test_get_db_returns_session(self, db_session: AsyncSession):
        result = await db_session.execute(text("SELECT 1"))
        assert result.scalar() == 1


class TestSecurity:
    def test_hash_and_verify_password(self):
        hashed = hash_password("mysecret")
        assert hashed != "mysecret"
        assert verify_password("mysecret", hashed) is True
        assert verify_password("wrong", hashed) is False

    def test_decode_expired_token(self):
        import jwt
        from nexus.core.config import settings
        from datetime import datetime, timedelta, UTC

        token = jwt.encode(
            {"sub": "test", "role": "admin", "exp": datetime.now(UTC) - timedelta(hours=1)},
            settings.secret_key,
            algorithm=settings.jwt_algorithm,
        )
        with pytest.raises(HTTPException) as exc:
            decode_access_token(token)
        assert exc.value.status_code == 401
        assert exc.value.detail == "Token expired"

    def test_decode_invalid_token(self):
        with pytest.raises(HTTPException) as exc:
            decode_access_token("not-a-valid-token")
        assert exc.value.status_code == 401

    async def test_require_role_admin_success(self, test_user):
        check = require_role("viewer")
        result = await check(test_user)
        assert result == test_user

    async def test_require_role_insufficient(self, test_user):
        test_user.role = "viewer"
        check = require_role("admin")
        with pytest.raises(HTTPException) as exc:
            await check(test_user)
        assert exc.value.status_code == 403
