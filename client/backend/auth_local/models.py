# backend/auth_local/models.py
"""本地 License 缓存模型 — SQLite 表"""

from sqlalchemy import Boolean, Column, String

from db import Base


class LicenseCache(Base):
    """License 本地缓存表"""

    __tablename__ = "license_cache"

    username = Column(String(64), primary_key=True)
    token = Column(String(512), nullable=False)
    pc_hash = Column(String(128), nullable=False)
    pc_name = Column(String(128), default="")
    tier = Column(String(32), default="")
    expires_at = Column(String(32), nullable=False)
    last_verify_at = Column(String(32), nullable=False)
    locked = Column(Boolean, default=False)
