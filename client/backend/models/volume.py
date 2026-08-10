import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class Volume(Base):
    """卷元数据表（development-plan §5.1）—— 卷/章数据底座。

    本 change 只建表 + 回填，业务端点仍走文件；change 006 起写路径双写。
    """

    __tablename__ = "volumes"
    __table_args__ = (
        UniqueConstraint("project_id", "volume_no", name="uq_volumes_project_volume_no"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    volume_no: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    chapter_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    project = relationship("Novel", back_populates="volumes")
    chapters = relationship(
        "Chapter",
        cascade="all, delete-orphan",
        back_populates="volume",
    )
