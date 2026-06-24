from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from prometheus_client import REGISTRY, generate_latest

from nexus.api import ai, alerts, auth, dashboard, devices, scans, webhooks, ws
from nexus.core.config import settings
from nexus.core.limiter import limiter

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="NEXUS API",
    version="0.1.0",
    description="Unified Operations & Security Intelligence Platform",
)
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
async def metrics():
    return PlainTextResponse(generate_latest(REGISTRY))
