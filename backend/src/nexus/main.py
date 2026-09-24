from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from prometheus_client import REGISTRY, generate_latest

from nexus.api import ai, alerts, auth, dashboard, devices, scans, webhooks, ws
from nexus.core.config import settings
from nexus.core.limiter import limiter
from nexus.scanner.registry import reap_stale_scans

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    reaped = await reap_stale_scans()
    if reaped:
        logger.warning("Startup reaper marked %d scan(s) as failed", reaped)
    yield


app = FastAPI(
    title="NEXUS API",
    version="0.1.0",
    description="Unified Operations & Security Intelligence Platform",
    lifespan=lifespan,
)
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(devices.router)
app.include_router(scans.router)
app.include_router(dashboard.router)
app.include_router(alerts.router)
app.include_router(ai.router)
app.include_router(ws.router)
app.include_router(webhooks.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics(request: Request):
    token = settings.metrics_token
    if token:
        auth_header = request.headers.get("authorization", "")
        provided = auth_header.removeprefix("Bearer ").strip()
        if not secrets.compare_digest(provided, token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid metrics token",
            )
    return PlainTextResponse(generate_latest(REGISTRY))
