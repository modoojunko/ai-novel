"""Genre model — global genre definitions (preset + custom).

题材定义全局共享（单用户桌面应用，无 user_id）。嵌套结构（toneBlueprint /
genreConfig / taboos / storyArcTemplates）以 JSON 字符串存入 Text 列，
与 ApiConfig.models 的存法一致，序列化/反序列化集中在 genres/service.py。
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class Genre(Base):
    __tablename__ = "genres"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # slug
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    narrator_role: Mapped[str] = mapped_column(Text, default="")
    typical_arc: Mapped[str] = mapped_column(Text, default="")
    tone_blueprint: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    taboos: Mapped[str] = mapped_column(Text, default="[]")  # JSON
    prompt_injection: Mapped[str] = mapped_column(Text, default="")
    genre_config: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    story_arc_templates: Mapped[str] = mapped_column(Text, default="[]")  # JSON
    is_preset: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
