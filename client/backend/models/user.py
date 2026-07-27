import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), default="")
    token_balance: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    plan: Mapped[str] = mapped_column(String(20), default="free")
    role: Mapped[str] = mapped_column(String(20), default="user")
    status: Mapped[str] = mapped_column(String(20), default="active")
    trial_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    subscription_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    subscription_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    is_lifetime: Mapped[bool] = mapped_column(Boolean, default=False)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    api_key: Mapped[str] = mapped_column(String(512), default="", server_default="")
    api_base_url: Mapped[str] = mapped_column(
        String(500), default="https://api.deepseek.com/anthropic"
    )
    api_model: Mapped[str] = mapped_column(String(100), default="deepseek-v4-flash")
    token: Mapped[str] = mapped_column(String(512), default="", server_default="")
    pc_hash: Mapped[str] = mapped_column(String(64), default="", server_default="")
    pc_name: Mapped[str] = mapped_column(String(200), default="", server_default="")
    server_api: Mapped[str] = mapped_column(String(500), default="", server_default="")
    migrated: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    api_configs = relationship(
        "ApiConfig",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
