"""Admin management API routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from admin.middleware import require_admin
from admin.service import (
    get_user_stats, get_project_stats, get_token_stats,
    list_users, get_user_detail, update_user_plan, topup_tokens,
    list_all_projects, get_user_token_logs,
)
from db import get_db
from models.user import User
from models.token_log import TokenLog

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def dashboard_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user_stats = await get_user_stats(db)
    project_stats = await get_project_stats(db)
    token_stats = await get_token_stats(db)
    return {**user_stats, **project_stats, **token_stats}


@router.get("/users")
async def users_list(
    page: int = 1,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users, total = await list_users(db, page)
    return {
        "users": [
            {"id": u.id, "email": u.email, "display_name": u.display_name,
             "role": u.role, "status": u.status, "plan": u.plan,
             "token_balance": u.token_balance, "subscription_type": u.subscription_type,
             "created_at": str(u.created_at) if u.created_at else None}
            for u in users
        ],
        "total": total,
        "page": page,
    }


@router.get("/users/{user_id}")
async def user_detail(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await get_user_detail(db, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")
    return {
        "id": user.id, "email": user.email, "display_name": user.display_name,
        "role": user.role, "status": user.status, "plan": user.plan,
        "token_balance": user.token_balance, "total_tokens": user.total_tokens,
        "subscription_type": user.subscription_type,
        "is_lifetime": user.is_lifetime,
        "created_at": str(user.created_at) if user.created_at else None,
    }


@router.put("/users/{user_id}/plan")
async def change_user_plan(
    user_id: str, body: dict,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    sub_type = body.get("subscription_type")
    user = await update_user_plan(db, user_id, subscription_type=sub_type)
    if not user:
        raise HTTPException(404, "用户不存在")
    return {"ok": True, "subscription_type": user.subscription_type, "status": user.status}


@router.post("/users/{user_id}/topup")
async def topup(
    user_id: str, body: dict,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    amount = body.get("amount", 0)
    if amount <= 0:
        raise HTTPException(400, "点数必须大于0")
    user = await topup_tokens(db, user_id, amount)
    if not user:
        raise HTTPException(404, "用户不存在")
    return {"ok": True, "token_balance": user.token_balance}


@router.get("/projects")
async def projects_list(
    page: int = 1,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    projects, total = await list_all_projects(db, page)
    return {
        "projects": [
            {"id": p.id, "name": p.name, "slug": p.slug,
             "user_id": p.user_id, "current_phase": p.current_phase,
             "status": p.status, "total_chapters": p.total_chapters,
             "created_at": str(p.created_at) if p.created_at else None}
            for p in projects
        ],
        "total": total,
        "page": page,
    }


@router.get("/token-logs")
async def token_logs(
    user_id: str | None = None,
    limit: int = 50,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if user_id:
        logs = await get_user_token_logs(db, user_id, limit)
    else:
        result = await db.execute(
            select(TokenLog).order_by(TokenLog.created_at.desc()).limit(limit)
        )
        logs = list(result.scalars().all())
    return [
        {"id": l.id, "user_id": l.user_id, "operation": l.operation,
         "model": l.model, "tokens_in": l.tokens_in, "tokens_out": l.tokens_out,
         "created_at": str(l.created_at) if l.created_at else None}
        for l in logs
    ]
