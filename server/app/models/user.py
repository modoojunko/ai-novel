from __future__ import annotations

from sqlalchemy import Column, DateTime, String, Text, func

from app.models.base import Base


class UserORM(Base):
    __tablename__ = "users"

    username            = Column(String(128), primary_key=True)
    password_hash       = Column(String(256), nullable=False)
    security_question   = Column(Text, default="", server_default="")
    security_answer_hash= Column(String(256), default="", server_default="")
    status              = Column(String(32), default="active", server_default="active", index=True)
    created_at          = Column(DateTime, server_default=func.now())
