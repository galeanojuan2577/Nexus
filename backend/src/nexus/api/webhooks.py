from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexus.core.database import get_db
from nexus.core.security import get_current_user
from nexus.models.user import User
from nexus.models.webhook import Webhook
from nexus.schemas.webhook import WebhookCreate, WebhookResponse, WebhookUpdate

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/", response_model=list[WebhookResponse])
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    result = await db.execute(
        select(Webhook)
        .where(Webhook.user_id == user.id)
        .offset(skip)
        .limit(limit)
        .order_by(Webhook.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    body: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    webhook = Webhook(
        user_id=user.id,
        name=body.name,
        provider=body.provider,
        url=body.url,
        events=body.events,
        enabled=body.enabled,
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    return webhook


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: str,
    body: WebhookUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id, Webhook.user_id == user.id
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )
    update_data = body.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(webhook, key, val)
    await db.commit()
    await db.refresh(webhook)
    return webhook


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id, Webhook.user_id == user.id
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )
    await db.delete(webhook)
    await db.commit()
