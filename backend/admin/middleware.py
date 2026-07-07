"""Admin role and active status check dependencies."""

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from auth.middleware import get_current_user
from db import get_db
from models.user import User


async def require_admin(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Require admin role for management endpoints."""
    result = await db.execute(select(User).where(User.id == user["id"]))
    u = result.scalar_one_or_none()
    if not u or u.role != "admin":
        raise HTTPException(403, "管理员权限不足")
    return u


async def check_active(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if user has active status for write operations."""
    result = await db.execute(select(User).where(User.id == user["id"]))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(401, "用户不存在")
    if u.role == "admin":
        return u
    if u.status != "active":
        raise HTTPException(403, "账号未激活，请续费后使用")
    return u
