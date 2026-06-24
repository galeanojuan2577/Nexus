from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexus.core.database import get_db
from nexus.core.security import get_current_user
from nexus.models.alert import Alert
from nexus.models.device import Device
from nexus.models.user import User
from nexus.schemas.alert import AlertResponse

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/", response_model=list[AlertResponse])
async def list_alerts(
    resolved: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    query = select(Alert).join(Device).where(Device.owner_id == user.id)
    if resolved is not None:
        query = query.where(Alert.resolved == resolved)
    query = query.offset(skip).limit(limit).order_by(Alert.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.put("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Alert).join(Device).where(
            Alert.id == alert_id,
            Device.owner_id == user.id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    alert.resolved = True
    await db.commit()
    await db.refresh(alert)
    return alert
