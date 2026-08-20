"""Chapter version management: list, restore（chapter_versions 表，PR③ 入库）。

version_id 对外保持 `v{13 位毫秒}` 形态（前端零改动）；表内存 BIGINT。
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth_local.middleware import get_current_user
from db import get_db
from models.chapter import Chapter, ChapterVersion
from novels.service import get_novel
from workflow.engine import _validate_ref, load_chapter, save_chapter, strip_suffix

router = APIRouter(
    prefix="/api/novels/{project_id}/chapters/{chapter_ref}", tags=["versions"]
)


async def _get_version_rows(db: AsyncSession, root_path: str, ref: str):
    """root_path + ref → 该章全部快照（新→旧）。"""
    from models.project import Novel

    stmt = (
        select(ChapterVersion)
        .join(Chapter, Chapter.id == ChapterVersion.chapter_id)
        .join(Novel, Novel.id == Chapter.project_id)
        .where(Novel.root_path == root_path, Chapter.ref == strip_suffix(ref))
        .order_by(ChapterVersion.version.desc())
    )
    return (await db.scalars(stmt)).all()


async def _get_version_row(db: AsyncSession, root_path: str, ref: str, version_id: str):
    rows = await _get_version_rows(db, root_path, ref)
    want = version_id.removeprefix("v")
    for r in rows:
        if str(r.version) == want:
            return r
    return None


@router.get("/versions")
async def list_versions(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    rows = await _get_version_rows(db, project.root_path, chapter_ref)
    versions = [
        {
            "version": f"v{r.version}",
            "time": r.version,
            "comment": r.comment or "",
            "isCurrent": False,
        }
        for r in rows
    ]
    if versions:
        versions[0]["isCurrent"] = True
    return versions


@router.get("/versions/{version_id}/content")
async def get_version_content(
    project_id: str,
    chapter_ref: str,
    version_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    row = await _get_version_row(db, project.root_path, chapter_ref, version_id)
    if row is None:
        raise HTTPException(404, "Version not found")

    snapshot = json.loads(row.snapshot or "{}")
    prose = snapshot.get("prose")
    if not prose:
        raise HTTPException(404, "Version not found")

    return {
        "version": f"v{row.version}",
        "time": row.version,
        "comment": row.comment or "",
        "prose": prose,
    }


@router.post("/versions/{version_id}/restore")
async def restore_version(
    project_id: str,
    chapter_ref: str,
    version_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    row = await _get_version_row(db, project.root_path, chapter_ref, version_id)
    if row is None:
        raise HTTPException(404, "Version not found")

    snapshot = json.loads(row.snapshot or "{}")
    if not snapshot:
        raise HTTPException(400, "Version has no snapshot data")

    chapter = await load_chapter(project.root_path, chapter_ref) or {}
    chapter["prose"] = snapshot.get("prose", chapter.get("prose", ""))
    if "outline" in snapshot:
        chapter["outline"] = snapshot["outline"]
    if "status" in snapshot:
        chapter["status"] = snapshot["status"]

    # 统一写入口：回滚 prose/status 后 word_count/outline_status 随落库同步派生（BE-13）
    await save_chapter(project.root_path, chapter_ref, chapter)
    return {"ok": True, "restored": f"v{row.version}"}
