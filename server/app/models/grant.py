from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, Text, func

from app.models.base import Base


class DeviceGrantORM(Base):
    """设备授权凭证（原 auth_tokens 表重构）。"""
    __tablename__ = "device_grants"

    pc_hash     = Column(String(128), primary_key=True)
    user_id     = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True)
    token       = Column(Text, nullable=False)
    enrolled    = Column(Integer, default=0, server_default="0")  # 0/1 一次性标记
    fingerprint = Column(String(256), default="", server_default="")
    created_at  = Column(DateTime, server_default=func.now())
