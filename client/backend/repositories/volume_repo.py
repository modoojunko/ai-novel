"""Volume repository — volumes 表 DB 查询层（development-plan §5.1）。"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.volume import Volume


async def list_by_project(db: AsyncSession, project_id: str) -> list[Volume]:
    stmt = (
        select(Volume)
        .where(Volume.project_id == project_id)
        .order_by(Volume.volume_no)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _parse_volume_no(ref_or_no) -> int | None:
    """容 `.yaml` 尾缀：`vol-1` / `vol-1.yaml` / `1` → 卷号；无法解析返 None。"""
    if isinstance(ref_or_no, int):
        return ref_or_no
    s = str(ref_or_no)
    if s.endswith(".yaml"):
        s = s[: -len(".yaml")]
    if s.startswith("vol-"):
        s = s[len("vol-") :]
    try:
        return int(s)
    except (TypeError, ValueError):
        return None


async def get_by_ref_or_number(
    db: AsyncSession, project_id: str, ref_or_no
) -> Volume | None:
    vol_no = _parse_volume_no(ref_or_no)
    if vol_no is None:
        return None
    return await get_by_volume_no(db, project_id, vol_no)


async def get_by_volume_no(
    db: AsyncSession, project_id: str, volume_no: int
) -> Volume | None:
    stmt = select(Volume).where(
        Volume.project_id == project_id, Volume.volume_no == volume_no
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def max_volume_no(db: AsyncSession, project_id: str) -> int:
    stmt = select(func.max(Volume.volume_no)).where(Volume.project_id == project_id)
    result = await db.execute(stmt)
    return result.scalar() or 0


async def upsert(
    db: AsyncSession,
    project_id: str,
    volume_no: int,
    *,
    title: str,
    summary: str = "",
) -> Volume:
    """按 UNIQUE(project_id, volume_no) 找，缺则 insert；flush 但不 commit（交调用方事务）。"""
    row = await get_by_volume_no(db, project_id, volume_no)
    if row is not None:
        if title and title != row.title:
            row.title = title
        if summary and summary != row.summary:
            row.summary = summary
        return row
    row = Volume(
        project_id=project_id,
        volume_no=volume_no,
        title=title,
        summary=summary,
    )
    db.add(row)
    await db.flush()
    return row


async def count_by_project(db: AsyncSession, project_id: str) -> int:
    stmt = (
        select(func.count(Volume.id)).where(Volume.project_id == project_id)
    )
    result = await db.execute(stmt)
    return result.scalar() or 0


async def ensure_volume_row(
    db: AsyncSession,
    project_id: str,
    volume_no: int,
    *,
    title: str | None = None,
) -> Volume:
    """懒补统一收口：卷行缺失 → upsert 卷（title 兜底「导入卷 N」）再插章行。

    供 change 006 双写与读路径自愈复用；行已存在直接返回。
    """
    row = await get_by_volume_no(db, project_id, volume_no)
    if row is not None:
        return row
    return await upsert(
        db, project_id, volume_no, title=title or f"导入卷 {volume_no}"
    )
