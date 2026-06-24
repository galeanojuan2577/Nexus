from __future__ import annotations

import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexus.core.config import settings
from nexus.core.database import get_db
from nexus.core.limiter import limiter
from nexus.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from nexus.models.password_reset import PasswordResetToken
from nexus.models.user import User
from nexus.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.rate_limit_auth)
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        email=body.email,
        name=body.name,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    token = create_access_token(user.id, user.role)
    return AuthResponse(access_token=token)


@router.post("/login", response_model=AuthResponse)
@limiter.limit(settings.rate_limit_auth)
async def login(
    request: Request,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_access_token(user.id, user.role)
    return AuthResponse(access_token=token)


@router.post("/forgot-password")
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}

    token = secrets.token_urlsafe(48)
    reset = PasswordResetToken(user_id=user.id, token=token)
    db.add(reset)
    await db.commit()

    return {
        "message": "If the email exists, a reset link has been sent",
        "reset_token": token,
    }


@router.post("/reset-password")
@limiter.limit("5/hour")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == body.token,
            PasswordResetToken.used.is_(False),
            PasswordResetToken.expires_at > datetime.now(UTC),
        )
    )
    reset = result.scalar_one_or_none()
    if not reset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user_result = await db.execute(
        select(User).where(User.id == reset.user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.hashed_password = hash_password(body.new_password)
    reset.used = True
    await db.commit()

    return {"message": "Password has been reset successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return user
