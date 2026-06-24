from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class WebhookCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    provider: str = Field(pattern="^(slack|telegram|email)$")
    url: str = Field(min_length=1)
    events: str = Field(min_length=1)
    enabled: bool = True


class WebhookUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    provider: str | None = Field(default=None, pattern="^(slack|telegram|email)$")
    url: str | None = Field(default=None, min_length=1)
    events: str | None = Field(default=None, min_length=1)
    enabled: bool | None = None


class WebhookResponse(BaseModel):
    id: str
    name: str
    provider: str
    url: str
    events: str
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}
