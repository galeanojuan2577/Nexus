from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(default=80, ge=1, le=65535)
    device_type: str = Field(
        default="http", pattern="^(http|https|tcp|ping|dns)$"
    )
    tags: str | None = None


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    host: str | None = Field(default=None, min_length=1, max_length=255)
    port: int | None = Field(default=None, ge=1, le=65535)
    device_type: str | None = Field(
        default=None, pattern="^(http|https|tcp|ping|dns)$"
    )
    tags: str | None = None


class DeviceResponse(BaseModel):
    id: str
    name: str
    host: str
    port: int
    device_type: str
    tags: str | None
    owner_id: str
    status: str
    last_check: datetime | None
    response_time_ms: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
