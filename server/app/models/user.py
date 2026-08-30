from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, String, Text, func

from app.models.base import Base


class UserORM(Base):
    __tablename__ = "users"

    username            = Column(String(128), primary_key=True)
    password_hash       = Column(String(256), nullable=False)
    security_question   = Column(Text, default="", server_default="")
    security_answer_hash= Column(String(256), default="", server_default="")
    status              = Column(String(32), default="active", server_default="active", index=True)
    theme               = Column(String(32), default="", server_default="")
    created_at          = Column(DateTime, server_default=func.now())
    # 账号自助注销（account-deletion）：中文枚举沿 codes 风格（design D1）
    deletion_status     = Column(String(32), default="正常", server_default="正常", index=True)
    deletion_requested_at = Column(DateTime, nullable=True)
    deletion_deadline   = Column(DateTime, nullable=True)
    deletion_waive_assets = Column(Boolean, default=False, server_default="0")
