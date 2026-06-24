from __future__ import annotations

import asyncio

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from nexus.core.database import get_db
from nexus.core.security import get_current_user
from nexus.models.device import Device
from nexus.models.user import User
from nexus.schemas.device import DeviceCreate, DeviceResponse, DeviceUpdate

COMMON_PORTS: list[tuple[int, str, str]] = [
    (80, "http", "HTTP"),
    (443, "https", "HTTPS"),
    (8080, "http", "HTTP Alternate"),
    (8443, "https", "HTTPS Alternate"),
    (3000, "http", "Development"),
    (5000, "http", "Flask/Express"),
    (8000, "http", "API Server"),
    (9090, "http", "Prometheus"),
    (22, "tcp", "SSH"),
    (21, "tcp", "FTP"),
]


class ProbeRequest(BaseModel):
    host: str


class ProbeResult(BaseModel):
    port: int
    device_type: str
    label: str
    open: bool
    http_status: int | None = None
    server: str | None = None


class ProbeResponse(BaseModel):
    host: str
    results: list[ProbeResult]

router = APIRouter(prefix="/devices", tags=["devices"])


async def _probe_port(host: str, port: int, scheme: str) -> ProbeResult:
    label = {p: lb for p, _s, lb in COMMON_PORTS}.get(port, f"Port {port}")
    try:
        url = f"{scheme}://{host}:{port}"
        async with httpx.AsyncClient(timeout=3, verify=False) as c:
            resp = await c.get(url)
            return ProbeResult(
                port=port,
                device_type="https" if port in (443, 8443) else scheme,
                label=label,
                open=True,
                http_status=resp.status_code,
                server=resp.headers.get("server"),
            )
    except (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError):
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=2
            )
            writer.close()
            return ProbeResult(
                port=port,
                device_type="tcp",
                label=label,
                open=True,
            )
        except (TimeoutError, OSError):
            return ProbeResult(
                port=port, device_type="tcp", label=label, open=False
            )
    except Exception:
        return ProbeResult(
            port=port, device_type="tcp", label=label, open=False
        )


@router.post("/probe", response_model=ProbeResponse)
async def probe_device(body: ProbeRequest, user: User = Depends(get_current_user)):
    host = body.host.strip().lower()
    host = host.replace("http://", "").replace("https://", "").split("/")[0]
    tasks = [_probe_port(host, p, s) for p, s, _ in COMMON_PORTS]
    results = await asyncio.gather(*tasks)
    return ProbeResponse(host=host, results=[r for r in results if r.open])


@router.get("/", response_model=list[DeviceResponse])
async def list_devices(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str = Query("", max_length=100),
):
    query = select(Device).where(Device.owner_id == user.id)
    if search:
        query = query.where(
            Device.name.ilike(f"%{search}%")
            | Device.host.ilike(f"%{search}%")
        )
    query = query.offset(skip).limit(limit).order_by(Device.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    body: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    device = Device(
        name=body.name,
        host=body.host,
        port=body.port,
        device_type=body.device_type,
        tags=body.tags,
        owner_id=user.id,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.owner_id == user.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    return device


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: str,
    body: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.owner_id == user.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(device, key, value)
    await db.commit()
    await db.refresh(device)
    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.owner_id == user.id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )
    await db.delete(device)
    await db.commit()
