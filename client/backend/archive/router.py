from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from archive.service import archive_chapter
from auth_local.middleware import get_current_user
from db import get_db
from filesystem.storage import get_storage
from novels.service import get_novel
from workflow.engine import _validate_ref
from workflow.tier import tier_phase_transition

router = APIRouter(
    prefix="/api/novels/{project_id}/chapters/{chapter_ref}/archive",
    tags=["archive"],
)

archives_router = APIRouter(
    prefix="/api/novels/{project_id}/archives",
    tags=["archives"],
)


@router.post("")
async def archive(
    project_id: str,
    chapter_ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    full_text = body.get("full_text", "")
    if len(full_text) < 100:
        raise HTTPException(400, "Text too short to archive")

    result = await archive_chapter(project.root_path, chapter_ref, full_text)
    # force：归档是内容驱动操作（≥100 字已校验），phase 仅记账，不再要求 write→archive
    # 严格流转——直接写第一章的手工路径 phase 停在 outline，严格校验会 500。
    tier_phase_transition(project, "archive", force=True)
    project.total_archives += 1

    # 双写第二步：以 YAML（status=archived）为准刷新 DB 章行；archived_at 为 DB-only 字段显式置
    from chapters.service import refresh_chapter_meta

    await refresh_chapter_meta(db, project, chapter_ref)
    try:
        from repositories import chapter_repo

        row = await chapter_repo.get_by_ref(db, project.id, chapter_ref)
        if row is not None:
            row.status = "archived"
            row.archived_at = datetime.now(UTC).replace(tzinfo=None)
        await db.commit()
    except Exception:  # noqa: BLE001, S110 — DB 失败不 500（YAML 已 archived，读路径自愈）
        pass

    return result


@archives_router.get("")
async def list_archives(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    files = await get_storage().list_dir(project.root_path, "archives")
    files = sorted(files, reverse=True)
    return [
        {"filename": f, "path": f"archives/{f}"} for f in files if f.endswith(".md")
    ]


@archives_router.get("/{filename}")
async def get_archive(
    project_id: str,
    filename: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    content = await get_storage().read_md(project.root_path, f"archives/{filename}")
    if not content:
        raise HTTPException(404, "Archive not found")
    return {"filename": filename, "content": content}
