import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class Chapter(Base):
    """章元数据表（development-plan §5.2）—— 卷/章数据底座。

    volume_id FK ondelete CASCADE + ORM relationship cascade 双保险
    （db.py 已 PRAGMA foreign_keys=ON，级联真生效）。
    """

    __tablename__ = "chapters"
    __table_args__ = (
        UniqueConstraint("project_id", "ref", name="uq_chapters_project_ref"),
        Index("ix_chapters_project_volume_status", "project_id", "volume_id", "status"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    volume_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("volumes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chapter_no: Mapped[int] = mapped_column(Integer, nullable=False)
    ref: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="outline")
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    has_prose: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    outline_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="unfilled"
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    project = relationship("Novel", back_populates="chapters")
    volume = relationship("Volume", back_populates="chapters")
