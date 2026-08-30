from __future__ import annotations

from sqlalchemy import BigInteger, Column, DateTime, String, Text, func

from app.models.base import Base


class UserORM(Base):
    __tablename__ = "users"

    id                  = Column(BigInteger, autoincrement=True, primary_key=True)
    username            = Column(String(128), nullable=False, unique=True, index=True)
    password_hash       = Column(String(256), nullable=False)
    security_question   = Column(Text, default="", server_default="")
    security_answer_hash= Column(String(256), default="", server_default="")
    status              = Column(String(32), default="active", server_default="active", index=True)
    theme               = Column(String(32), default="", server_default="")
    created_at          = Column(DateTime, server_default=func.now())
