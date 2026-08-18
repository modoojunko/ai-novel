from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)

from app.models.base import Base


class DeviceRegistryORM(Base):
    __tablename__ = "device_registry"

    id              = Column(String(32), primary_key=True)  # hex UUID (32 chars)
    user_id         = Column(String(128), ForeignKey("users.username"), nullable=False, index=True)
    fingerprint     = Column(String(256), default="", server_default="")
    hostname        = Column(String(256), default="", server_default="")
    os              = Column(String(128), default="", server_default="")
    os_arch         = Column(String(32), default="", server_default="")
    last_active_at  = Column(DateTime, server_default=func.now())
    bound_at        = Column(DateTime, server_default=func.now())
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "fingerprint", name="uq_user_fingerprint"),
    )
