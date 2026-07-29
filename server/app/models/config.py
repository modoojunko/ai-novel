"""global_config ORM 模型。"""
from __future__ import annotations
from sqlalchemy import Column, String, Text
from app.models.base import Base


class GlobalConfigORM(Base):
    __tablename__ = "global_config"

    key   = Column(String(128), primary_key=True)
    value = Column(Text, nullable=False)
