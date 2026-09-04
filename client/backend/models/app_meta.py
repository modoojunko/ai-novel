"""AppMeta — 应用级元数据 KV（c-novel-export-roundtrip PR0）。

当前唯一键：schema_id（schema 指纹，见 legacy_archive.py）。
启动期判定「这台库是不是当前版本的结构」——匹配则正常启动，
不匹配则整库留档并以全新空库启动（单轨升级，零迁移零召回）。
"""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class AppMeta(Base):
    __tablename__ = "app_meta"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
