from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from nexus.core.database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(default=80)
    device_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="http"
    )
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="unknown"
    )
    last_check: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    response_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    owner = relationship("User", back_populates="devices")
    scans = relationship("Scan", back_populates="device")
    alerts = relationship("Alert", back_populates="device")
