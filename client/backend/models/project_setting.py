"""ProjectSetting model — 项目设定 KV 表（ADR-002）。

settings 入库：8 类单文件设定 + 字符目录，content 以 JSON 存 Text 列。
root_path + key 复合主键，无外键——storage 是通用 KV 不绑业务表，
root_path 由 slug 派生（create_project 冲突追加 uuid 后缀），所有权在路由层校验。
"""

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from db import Base


class ProjectSetting(Base):
    __tablename__ = "project_settings"

    root_path: Mapped[str] = mapped_column(String(500), primary_key=True)
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # JSON 序列化
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
