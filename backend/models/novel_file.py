from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class NovelFile(Base):
    __tablename__ = "novel_files"

    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    project_slug: Mapped[str] = mapped_column(String(200), primary_key=True)
    file_path: Mapped[str] = mapped_column(String(500), primary_key=True)
    content: Mapped[str] = mapped_column(Text, default="")
    content_type: Mapped[str] = mapped_column(String(10), default="yaml")
