"""Admin service — user management, stats, token operations."""

from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from models.token_log import TokenLog
from models.project import Project


async def get_user_stats(db: AsyncSession) -> dict:
    """Get aggregated user statistics."""
    total = await db.scalar(select(func.count(User.id)))
    active = await db.scalar(select(func.count(User.id)).where(User.status == "active"))
    inactive = await db.scalar(select(func.count(User.id)).where(User.status == "inactive"))
    admins = await db.scalar(select(func.count(User.id)).where(User.role == "admin"))
    return {
        "total_users": total or 0,
        "active_users": active or 0,
        "inactive_users": inactive or 0,
        "admin_count": admins or 0,
    }


async def get_project_stats(db: AsyncSession) -> dict:
    """Get project statistics."""
    total = await db.scalar(select(func.count(Project.id)))
    return {"total_projects": total or 0}


async def get_token_stats(db: AsyncSession) -> dict:
    """Get token consumption statistics."""
    total = await db.scalar(select(func.sum(TokenLog.tokens_in + TokenLog.tokens_out)))
    total_calls = await db.scalar(select(func.count(TokenLog.id)))
    return {
        "total_tokens": total or 0,
        "total_calls": total_calls or 0,
    }


async def list_users(db: AsyncSession, page: int = 1, page_size: int = 20) -> tuple[list[User], int]:
    """List users with pagination."""
    query = select(User).order_by(User.created_at.desc())
    total = await db.scalar(select(func.count(User.id)))
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    return list(result.scalars().all()), total or 0


async def get_user_detail(db: AsyncSession, user_id: str) -> User | None:
    """Get full user details."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user_plan(
    db: AsyncSession, user_id: str,
    subscription_type: str | None = None,
    status: str | None = None,
) -> User | None:
    """Update user's plan/subscription."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    if subscription_type:
        user.subscription_type = subscription_type
        if subscription_type == "monthly":
            from datetime import timedelta
            user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        elif subscription_type == "quarterly":
            from datetime import timedelta
            user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=90)
        elif subscription_type == "yearly":
            from datetime import timedelta
            user.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=365)
        elif subscription_type == "lifetime":
            user.subscription_expires_at = None
            user.is_lifetime = True
        user.status = "active"

    if status:
        user.status = status

    await db.commit()
    await db.refresh(user)
    return user


async def topup_tokens(db: AsyncSession, user_id: str, amount: int) -> User | None:
    """Add tokens to user balance."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None
    user.token_balance += amount
    await db.commit()
    await db.refresh(user)
    return user


async def list_all_projects(db: AsyncSession, page: int = 1, page_size: int = 20) -> tuple[list[Project], int]:
    """List all projects with pagination."""
    query = select(Project).order_by(Project.created_at.desc())
    total = await db.scalar(select(func.count(Project.id)))
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    return list(result.scalars().all()), total or 0


async def get_user_token_logs(db: AsyncSession, user_id: str, limit: int = 50) -> list[TokenLog]:
    """Get token logs for a specific user."""
    result = await db.execute(
        select(TokenLog).where(TokenLog.user_id == user_id)
        .order_by(TokenLog.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
