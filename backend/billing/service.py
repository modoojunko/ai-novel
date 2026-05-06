from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.token_log import TokenLog
from models.user import User


async def log_token_usage(
    db: AsyncSession,
    user_id: str,
    project_id: str | None,
    chapter_id: str | None,
    operation: str,
    model: str,
    tokens_in: int,
    tokens_out: int,
):
    rates = {
        "haiku": (0.08, 0.40),
        "sonnet": (0.30, 1.50),
    }
    in_rate, out_rate = rates.get(model, (0.08, 0.40))
    cost = int((tokens_in / 1000) * in_rate + (tokens_out / 1000) * out_rate)

    log = TokenLog(
        user_id=user_id,
        project_id=project_id,
        chapter_id=chapter_id,
        operation=operation,
        model=model,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        cost_cents=max(cost, 0),
    )
    db.add(log)

    user = await db.get(User, user_id)
    if user:
        user.token_balance -= tokens_in + tokens_out
        user.total_tokens += tokens_in + tokens_out

    await db.commit()


async def get_usage_summary(db: AsyncSession, user_id: str) -> dict:
    result = await db.execute(
        select(
            func.sum(TokenLog.tokens_in + TokenLog.tokens_out).label("total"),
            func.sum(TokenLog.cost_cents).label("cost"),
            func.count().label("calls"),
        ).where(TokenLog.user_id == user_id)
    )
    row = result.one()
    return {
        "total_tokens": row.total or 0,
        "total_cost_cents": row.cost or 0,
        "total_calls": row.calls or 0,
    }
