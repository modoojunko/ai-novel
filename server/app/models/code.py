from __future__ import annotations
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, func
from app.models.base import Base


class ActivationCodeORM(Base):
    __tablename__ = "codes"

    code_id         = Column(String(32), primary_key=True)
    tier            = Column(String(32), nullable=False, index=True)
    duration_days   = Column(Integer, nullable=False)
    status          = Column(String(32), default="unused", server_default="unused", index=True)
    bound_username  = Column(String(128), ForeignKey("users.username"), default="", server_default="")
    activated_at    = Column(DateTime, nullable=True)
    expires_at      = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    created_by      = Column(String(64), default="", server_default="")
