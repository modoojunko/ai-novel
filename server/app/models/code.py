from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Integer, String, func

from app.models.base import Base


class ActivationCodeORM(Base):
    """权益台账行（原激活码表扩展：支付发货+两段式激活）。"""
    __tablename__ = "codes"

    code_id         = Column(String(32), primary_key=True)
    tier            = Column(String(32), nullable=False, index=True)
    duration_days   = Column(Integer, nullable=False)
    status          = Column(String(32), default="unused", server_default="unused", index=True)
    user_id         = Column(BigInteger, ForeignKey("users.id"), nullable=True, index=True)
    # 支付发货扩展（a002 加列）
    source          = Column(String(12), nullable=False, default="admin", server_default="admin")
    order_id        = Column(BigInteger, nullable=True, index=True)
    grant_start     = Column(DateTime, nullable=True)
    status_detail   = Column(String(24), nullable=True, default="unused", server_default="unused")
    activated_at    = Column(DateTime, nullable=True)
    expires_at      = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    created_by      = Column(String(64), default="", server_default="")
