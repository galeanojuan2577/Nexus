from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=6)
    role: str = Field(default="viewer", pattern="^(admin|analyst|viewer)$")


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
