from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from auth.middleware import get_current_user
from billing.service import get_usage_summary
from db import get_db

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/usage")
async def usage(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_usage_summary(db, user["id"])


@router.get("/plans")
async def plans():
    return [
        {"name": "Free", "tokens": 50000, "price_cents": 0},
        {"name": "Pro", "tokens": 500000, "price_cents": 1500},
        {"name": "Unlimited", "tokens": 2000000, "price_cents": 4900},
    ]
