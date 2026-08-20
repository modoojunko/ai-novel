"""Chapter repository — chapters 表 DB 查询层（development-plan §5.2）。"""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.chapter import Chapter


async def list_by_project(db: AsyncSession, project_id: str) -> list[Chapter]:
    """一次性拉全（供内存分组免 N+1）。"""
    stmt = select(Chapter).where(Chapter.project_id == project_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_ref(
    db: AsyncSession, project_id: str, ref: str
) -> Chapter | None:
    stmt = select(Chapter).where(Chapter.project_id == project_id, Chapter.ref == ref)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def has(db: AsyncSession, project_id: str, ref: str) -> bool:
    stmt = select(Chapter.id).where(Chapter.project_id == project_id, Chapter.ref == ref)
    result = await db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def upsert(
    db: AsyncSession,
    project_id: str,
    volume_id: str,
    *,
    chapter_no: int,
    ref: str,
    title: str,
    status: str = "outline",
    word_count: int = 0,
    has_prose: bool = False,
    outline_status: str = "unfilled",
    confirmed_at: datetime | None = None,
    archived_at: datetime | None = None,
) -> Chapter:
    """按 UNIQUE(project_id, ref) 找，缺则 insert；flush 但不 commit（交调用方事务）。"""
    row = await get_by_ref(db, project_id, ref)
    if row is not None:
        row.volume_id = volume_id
        row.chapter_no = chapter_no
        row.title = title
        row.status = status
        row.word_count = word_count
        row.has_prose = has_prose
        row.outline_status = outline_status
        row.confirmed_at = confirmed_at
        row.archived_at = archived_at
        return row
    row = Chapter(
        project_id=project_id,
        volume_id=volume_id,
        chapter_no=chapter_no,
        ref=ref,
        title=title,
        status=status,
        word_count=word_count,
        has_prose=has_prose,
        outline_status=outline_status,
        confirmed_at=confirmed_at,
        archived_at=archived_at,
    )
    db.add(row)
    await db.flush()
    return row


async def delete(db: AsyncSession, chapter_id: str) -> None:
    obj = await db.get(Chapter, chapter_id)
    if obj is not None:
        await db.delete(obj)


async def list_by_volume(
    db: AsyncSession, volume_id: str, *, ordered: bool = True
) -> list[Chapter]:
    """单卷章列表（卷详情组装用；默认按章号升序）。"""
    stmt = select(Chapter).where(Chapter.volume_id == volume_id)
    if ordered:
        stmt = stmt.order_by(Chapter.chapter_no)
    return list((await db.scalars(stmt)).all())


async def count_by_volume(db: AsyncSession, volume_id: str) -> int:
    """单卷章数（删卷计数维护用）。"""
    stmt = select(func.count(Chapter.id)).where(Chapter.volume_id == volume_id)
    return await db.scalar(stmt) or 0


async def max_chapter_no(
    db: AsyncSession, project_id: str, volume_id: str
) -> int:
    stmt = select(func.max(Chapter.chapter_no)).where(
        Chapter.project_id == project_id, Chapter.volume_id == volume_id
    )
    result = await db.execute(stmt)
    return result.scalar() or 0


async def count_by_project(db: AsyncSession, project_id: str) -> int:
    stmt = select(func.count(Chapter.id)).where(Chapter.project_id == project_id)
    result = await db.execute(stmt)
    return result.scalar() or 0


async def count_archived(db: AsyncSession, project_id: str) -> int:
    stmt = select(func.count(Chapter.id)).where(
        Chapter.project_id == project_id, Chapter.status == "archived"
    )
    result = await db.execute(stmt)
    return result.scalar() or 0
