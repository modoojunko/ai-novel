"""FastAPI Dependencies — 权限门控

require_ai_access(): 检查用户是否有 AI 使用权限
require_project_limit(): 检查免费用户是否超项目上限
"""

import os

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models.api_config import ApiConfig
from models.project import Project
from models.user import User

from .middleware import get_current_user
from .service import check_permission, get_local_config


async def require_ai_access(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI 功能门控：检查用户已配置 API Key（从 ApiConfig 或旧字段）"""
    # Check ApiConfig first (new system)
    try:
        result = await db.execute(
            select(ApiConfig)
            .where(
                ApiConfig.user_id == user["id"],
                ApiConfig.status == "active",
            )
            .limit(1)
        )
        if result.scalar_one_or_none():
            return True
    except Exception:  # noqa: S110
        pass

    # Fallback: check old User.api_key for migration period
    try:
        result = await db.execute(select(User).where(User.id == user["id"]))
        u = result.scalar_one_or_none()
        if u and u.api_key:
            return True
    except Exception:  # noqa: S110
        pass

    # Fallback to config.json
    cfg = get_local_config()
    if cfg.get("api_key"):
        return True

    if os.environ.get("DEV_MODE"):
        return True

    perm = check_permission()
    if not perm.get("allowed", False):
        raise HTTPException(403, perm.get("msg", "无使用权限"))

    # 免费用户在试用期外不能使用 AI
    if perm.get("tier") == "none" and perm.get("trial_remaining_days", 0) <= 0:
        raise HTTPException(403, "AI 试用已到期 — 购买套餐后继续使用 AI 功能")

    raise HTTPException(503, "AI 服务未配置 — 请先在设置中填写 API Key")


async def require_project_limit(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """项目上限门控：免费用户最多 1 个项目"""
    if os.environ.get("DEV_MODE"):
        return True

    perm = check_permission()
    limit = perm.get("project_limit")
    if limit is None:  # 付费用户无上限
        return True

    result = await db.execute(
        select(Project).where(
            Project.user_id == user["id"], Project.status != "deleted"
        )
    )
    count = len(result.scalars().all())
    if count >= limit:
        raise HTTPException(
            403, f"免费用户最多创建 {limit} 个项目 — 购买套餐后可创建更多"
        )

    return True
