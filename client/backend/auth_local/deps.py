"""FastAPI Dependencies — 权限门控

require_ai_access(): 检查用户是否有 AI 使用权限
require_project_limit(): 检查免费用户是否超项目上限
"""

import os
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .service import get_local_config, check_permission
from .middleware import get_current_user
from db import get_db
from models.project import Project


async def require_ai_access():
    """AI 功能门控：检查用户有 AI 权限且已配置 API Key"""
    cfg = get_local_config()
    if not cfg.get("api_key"):
        raise HTTPException(503, "AI 服务未配置 — 请先在设置中填写 API Key")

    if os.environ.get("DEV_MODE"):
        return True

    perm = check_permission()
    if not perm.get("allowed", False):
        raise HTTPException(403, perm.get("msg", "无使用权限"))

    # 免费用户在试用期外不能使用 AI
    if perm.get("tier") == "none" and perm.get("trial_remaining_days", 0) <= 0:
        raise HTTPException(403, "AI 试用已到期 — 购买套餐后继续使用 AI 功能")

    return True


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
