from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func

from app.models.base import Base


class ActivationCodeORM(Base):
    __tablename__ = "codes"

    code_id         = Column(String(32), primary_key=True)
    tier            = Column(String(32), nullable=False, index=True)
    duration_days   = Column(Integer, nullable=False)
    status          = Column(String(32), default="unused", server_default="unused", index=True)
    # 可空 FK：未绑定码必须存 NULL（'' 会触发 FK 检查失败）；Python 端不设 default，
    # 避免 flush 时把 None 转回空串
    bound_username  = Column(String(128), ForeignKey("users.username"), nullable=True)
    activated_at    = Column(DateTime, nullable=True)
    expires_at      = Column(DateTime, nullable=True)
    # 账号注销联动（account-deletion）：权益级退款申请时刻（空=未申请）
    refund_requested_at = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    created_by      = Column(String(64), default="", server_default="")
