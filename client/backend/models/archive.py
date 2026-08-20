"""Archive / ChapterPrompt 模型 — PR④ 数据全量入库。

- Archive：章归档全文 + 摘要（替代 archives/*.md）。一章最多一行（重归档即替换），
  随章行 FK CASCADE（删章/删卷/解档归档自动对称清理）。
- ChapterPrompt：章级生成提示词全文（替代 prompts/{ref}-*.md）。
  name 形如 "seg-1-prompt" / "write-prompt"，对外文件名 {ref}-{name}.md 派生。

两者 content 均为全库 TEXT 五处之二/之三。
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base


class Archive(Base):
    __tablename__ = "archives"
    __table_args__ = (
        UniqueConstraint("chapter_id", name="uq_archive_chapter"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chapter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    summary: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    archived_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # async 上下文禁隐性 lazy（PR③ Chapter.volume 同款）→ selectin 预载
    chapter = relationship("Chapter", lazy="selectin")


class ChapterPrompt(Base):
    __tablename__ = "chapter_prompts"
    __table_args__ = (
        UniqueConstraint("chapter_id", "name", name="uq_chpr_chapter_name"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chapter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
