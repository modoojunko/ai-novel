from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from auth_local.middleware import get_current_user
from chapters.service import get_chapter_row, save_chapter, save_prose
from db import get_db
from filesystem.storage import get_storage
from novels.service import get_novel
from workflow.engine import _validate_ref, load_chapter
from workflow.gates import gate_chapter_ready
from workflow.tier import tier_or_gate

router = APIRouter(prefix="/api/novels/{project_id}", tags=["chapters"])


# ── Volumes ────────────────────────────────────────────────────────────────


@router.get("/volumes")
async def list_volumes(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    from volumes.service import list_volumes as list_volumes_db

    return await list_volumes_db(db, project)


@router.post("/volumes")
async def create_volume(
    project_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    from volumes.service import create_volume as create_volume_db

    # body.vol_num 忽略（MAX+1，防撞 UNIQUE，B9/P2-N）
    return await create_volume_db(
        db, project, title=body.get("title", f"Volume {project.total_volumes + 1}"),
        summary=body.get("summary", ""),
    )


@router.get("/volumes/{ref}")
async def get_volume(
    project_id: str,
    ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    from volumes.service import get_volume as get_volume_db

    data = await get_volume_db(db, project, ref)
    if not data:
        raise HTTPException(404, "Volume not found")
    return data


@router.put("/volumes/{ref}")
async def update_volume(
    project_id: str,
    ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    from volumes.service import update_volume as update_volume_db

    return await update_volume_db(db, project, ref, body)


@router.delete("/volumes/{ref}")
async def delete_volume(
    project_id: str,
    ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    from volumes.service import delete_volume as delete_volume_db

    return await delete_volume_db(db, project, ref)


# ── Chapters ───────────────────────────────────────────────────────────────


@router.post("/volumes/{ref}/chapters")
async def create_chapter_in_volume(
    project_id: str,
    ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """卷内建章（替代旧 POST /chapters）：定位卷 → MAX+1 → 双写。"""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    from chapters.service import create_chapter

    return await create_chapter(
        db, project, ref, body.get("title", "新章节")
    )


@router.get("/chapters/{chapter_ref}")
async def get_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    data = await load_chapter(project.root_path, chapter_ref)
    if not data:
        raise HTTPException(404, "Chapter not found")
    # YAML 内容 + DB 元数据合并；行缺失读路径自愈（ensure_volume_row 懒补，B10）
    meta = await get_chapter_row(db, project, chapter_ref)
    if meta:
        data.update(meta)
    return data


@router.put("/chapters/{chapter_ref}")
async def update_chapter(
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
    await save_chapter(db, project, chapter_ref, body)
    return {"ok": True}


@router.put("/chapters/{chapter_ref}/prose")
async def update_chapter_prose(
    project_id: str,
    chapter_ref: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """编辑器自动保存专用：body {prose} → YAML + 版本快照 + refresh DB 元数据。"""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    await save_prose(db, project, chapter_ref, body.get("prose", ""))
    return {"ok": True}


@router.post("/chapters/{chapter_ref}/confirm")
async def confirm_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    chapter = await load_chapter(project.root_path, chapter_ref)
    result = await tier_or_gate(db, project, gate_chapter_ready, chapter)
    if not result.valid:
        # warnings 为中文缺失项（gate_chapter_ready），前端直接透传展示
        missing = "、".join(result.warnings)
        raise HTTPException(400, f"章纲确认失败，请先填写：{missing}")
    chapter["status"] = "confirmed"
    await get_storage().write_yaml(
        project.root_path, f"chapters/{chapter_ref}.yaml", chapter
    )
    # DB confirmed 态（status/outline_status/confirmed_at=now）；不再写内嵌列表
    from datetime import UTC, datetime

    from chapters.service import refresh_chapter_meta

    await refresh_chapter_meta(db, project, chapter_ref, chapter)
    try:
        from repositories import chapter_repo

        row = await chapter_repo.get_by_ref(db, project.id, chapter_ref)
        if row is not None:
            row.status = "confirmed"
            row.outline_status = "confirmed"
            row.confirmed_at = datetime.now(UTC).replace(tzinfo=None)
            await db.commit()
    except Exception:  # noqa: BLE001, S110 — DB 失败不 500（YAML 已 confirmed）
        pass
    return {"ok": True, "status": "confirmed"}


@router.post("/chapters/{chapter_ref}/unarchive")
async def unarchive_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """P2 unarchive：把归档章恢复为可编辑态（YAML draft + 清归档标记 + DB 清 archived_at）。"""
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    storage = get_storage()
    chapter = await storage.read_yaml(
        project.root_path, f"chapters/{chapter_ref}.yaml"
    )
    if not chapter:
        raise HTTPException(404, "Chapter not found")

    chapter["status"] = "draft"
    chapter.pop("archive_path", None)
    chapter.pop("archive_summary", None)
    await storage.write_yaml(
        project.root_path, f"chapters/{chapter_ref}.yaml", chapter
    )

    # 对称清理归档 .md（镜像 archive 写归档文件；列表读 archives/ 目录）
    vol_no = chapter.get("volume", 1)
    ch_no = chapter.get("chapter", 1)
    prefix = f"vol-{vol_no}-ch-{ch_no}-"
    for f in await storage.list_dir(project.root_path, "archives"):
        if f.startswith(prefix) and f.endswith(".md"):
            await storage.delete_file(project.root_path, f"archives/{f}")

    # 双写第二步：YAML draft → DB 清 archived_at + status=draft
    from chapters.service import refresh_chapter_meta

    await refresh_chapter_meta(db, project, chapter_ref, chapter)
    try:
        from repositories import chapter_repo

        row = await chapter_repo.get_by_ref(db, project.id, chapter_ref)
        if row is not None:
            row.status = "draft"
            row.archived_at = None
        await db.commit()
    except Exception:  # noqa: BLE001, S110 — DB 失败不 500（YAML 已 draft，读路径自愈）
        pass

    return {"ok": True, "ref": chapter_ref}


@router.delete("/chapters/{chapter_ref}")
async def delete_chapter(
    project_id: str,
    chapter_ref: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_novel(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)

    storage = get_storage()
    # 清理归档 .md（对称 unarchive 的 prefix 匹配；避免归档列表残留幽灵条目）
    from chapters.service import cleanup_chapter_artifacts

    await cleanup_chapter_artifacts(project.root_path, chapter_ref)
    await storage.delete_file(project.root_path, f"chapters/{chapter_ref}.yaml")
    # DB 行 + 计数维护（同 session commit）；不再改内嵌列表
    try:
        from repositories import chapter_repo, volume_repo
        from workflow.engine import strip_suffix

        row = await chapter_repo.get_by_ref(db, project.id, chapter_ref)
        if row is not None:
            await chapter_repo.delete(db, row.id)
            parts = strip_suffix(chapter_ref).split("-")
            vol = await volume_repo.get_by_volume_no(
                db, project.id, int(parts[1])
            )
            if vol is not None:
                vol.chapter_count = max(0, vol.chapter_count - 1)
            project.total_chapters = max(0, (project.total_chapters or 0) - 1)
        await db.commit()
    except Exception:  # noqa: BLE001, S110 — DB 失败不 500（YAML 已删，树由读路径自愈）
        pass
    return {"ok": True}
