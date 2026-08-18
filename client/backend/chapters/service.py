"""ChapterService — 章 CRUD 双写（YAML 先写、DB 后更；change 006）。

- create_chapter：卷内建章（POST /volumes/{ref}/chapters 替代旧 POST /chapters）；
  chapter_no = MAX+1；双写 + 计数同事务；不再写 vol YAML 内嵌 chapters 列表。
- save_chapter / save_prose：engine.save_chapter（YAML + 版本快照）+ refresh_chapter_meta。
- refresh_chapter_meta：ensure_volume_row 懒补前置；以重读 YAML 为准、只覆盖本次变更字段；
  DB 失败降级不 500（读路径自愈）。
"""

import logging

from fastapi import HTTPException

from filesystem.storage import get_storage
from novels.service import count_chars
from repositories import chapter_repo, volume_repo
from workflow.engine import load_chapter, strip_suffix
from workflow.engine import save_chapter as engine_save_chapter

logger = logging.getLogger("uvicorn.error")


def _parse_chapter_ref(ref: str) -> tuple[int, int]:
    """`vol-N-ch-M` → (N, M)；容 `.yaml` 尾缀；不匹配抛 400。"""
    ref = strip_suffix(ref)
    parts = ref.split("-")
    if len(parts) != 4 or parts[0] != "vol" or parts[2] != "ch":
        raise HTTPException(400, f"Invalid chapter reference: {ref}")
    try:
        return int(parts[1]), int(parts[3])
    except ValueError:
        raise HTTPException(400, f"Invalid chapter reference: {ref}")


def _derive_outline_status(status: str, prose: str) -> str:
    if status == "confirmed":
        return "confirmed"
    if (prose or "").strip():
        return "in_progress"
    return "unfilled"


async def cleanup_chapter_artifacts(root_path: str, chapter_ref: str) -> None:
    """删除章节的落盘产物：归档 .md（防归档列表幽灵条目）+ versions 快照。

    chapter YAML 由调用方删除；DB 行/计数由调用方维护。
    """
    storage = get_storage()
    chapter = await storage.read_yaml(root_path, f"chapters/{chapter_ref}.yaml")
    if chapter:
        vol_no = chapter.get("volume", 1)
        ch_no = chapter.get("chapter", 1)
        prefix = f"vol-{vol_no}-ch-{ch_no}-"
        for f in await storage.list_dir(root_path, "archives"):
            if f.startswith(prefix) and f.endswith(".md"):
                await storage.delete_file(root_path, f"archives/{f}")
    for f in await storage.list_dir(root_path, f"versions/{chapter_ref}"):
        await storage.delete_file(root_path, f"versions/{chapter_ref}/{f}")


async def create_chapter(db, project, volume_ref: str, title: str) -> dict:
    """卷内建章：定位卷 → MAX+1 → 双写（YAML 模板 + DB 行）+ 计数同事务。"""
    vol_no = int(strip_suffix(volume_ref).replace("vol-", ""))
    vol = await volume_repo.get_by_volume_no(db, project.id, vol_no)
    if vol is None:
        raise HTTPException(404, "Volume not found")

    chapter_no = await chapter_repo.max_chapter_no(db, project.id, vol.id) + 1
    ref = f"vol-{vol.volume_no}-ch-{chapter_no}"

    chapter_data = {
        "volume": vol.volume_no,
        "chapter": chapter_no,
        "title": title,
        "status": "outline",
        "outline": {
            "summary": "",
            "key_points": [],
            "characters": [],
            "location": "",
            "time": "",
            "narrative_pov": "",
        },
        "memo": {
            "current_task": "",
            "reader_expectation": {"state": "", "strategy": "", "detail": ""},
            "payoff_plan": {"must_resolve": [], "must_hold": [], "partial_advance": []},
            "downtime_functions": [],
            "key_choices": [],
            "required_changes": [],
            "prohibitions": [],
        },
        "segments": [],
    }
    await get_storage().write_yaml(project.root_path, f"chapters/{ref}.yaml", chapter_data)

    try:
        await chapter_repo.upsert(
            db, project.id, vol.id, chapter_no=chapter_no, ref=ref,
            title=title, status="outline", word_count=0, has_prose=False,
            outline_status="unfilled",
        )
        vol.chapter_count += 1
        project.total_chapters += 1
        await db.commit()
        logger.info("created chapter %s for project %s", ref, project.id)
    except Exception:
        logger.warning("create_chapter DB write failed for %s", ref, exc_info=True)

    return {"chapter_ref": ref, "ref": ref}


async def save_chapter(db, project, ref: str, data: dict) -> None:
    """YAML 写 + 版本快照 → refresh DB 元数据（双写第二步）。"""
    await engine_save_chapter(project.root_path, ref, data)
    await refresh_chapter_meta(db, project, ref, data)


async def save_prose(db, project, ref: str, prose: str) -> None:
    """编辑器自动保存专用：只更 prose，走同一双写链路。"""
    data = await load_chapter(project.root_path, ref) or {}
    data["prose"] = prose
    await engine_save_chapter(project.root_path, ref, data)
    await refresh_chapter_meta(db, project, ref, data)


async def refresh_chapter_meta(db, project, ref: str, data: dict | None = None) -> None:
    """以重读 YAML 为准刷新 DB 行；DB 行缺失 → ensure_volume_row 懒补（卷行前置）。

    data 仅作 title 兜底（payload 变更字段）；word_count/has_prose/status/outline_status
    一律从重读 YAML 派生，不整行覆盖 payload 缺省字段（P1-C）。
    """
    try:
        vol_no, chapter = _parse_chapter_ref(ref)
        vol = await volume_repo.ensure_volume_row(db, project.id, vol_no)
        yaml_data = await load_chapter(project.root_path, ref) or {}
        prose = yaml_data.get("prose", "")
        status = yaml_data.get("status") or "outline"
        row = await chapter_repo.get_by_ref(db, project.id, ref)
        title = (
            yaml_data.get("title")
            or (data or {}).get("title")
            or (row.title if row else f"第{chapter}章")
        )
        await chapter_repo.upsert(
            db, project.id, vol.id, chapter_no=chapter, ref=ref,
            title=title, status=status,
            word_count=count_chars(prose), has_prose=bool(prose.strip()),
            outline_status=_derive_outline_status(status, prose),
            confirmed_at=row.confirmed_at if row else None,
            archived_at=row.archived_at if row else None,
        )
        if row is None:
            vol.chapter_count += 1
            project.total_chapters += 1
        await db.commit()
    except Exception:
        # YAML 已落；DB 行由读路径自愈（GET 懒补）与启动回填兜底，不 500
        logger.warning("refresh_chapter_meta failed for %s", ref, exc_info=True)


async def self_heal_chapter(db, project, ref: str) -> None:
    """读路径自愈收口（BE-10）：DB 行缺失 → ensure_volume_row 懒补 + 插章行。"""
    await refresh_chapter_meta(db, project, ref)


async def get_chapter_row(db, project, ref: str) -> dict | None:
    """供 GET 合并返回的 DB 元数据；行缺失先自愈再取。"""
    row = await chapter_repo.get_by_ref(db, project.id, ref)
    if row is None:
        await self_heal_chapter(db, project, ref)
        row = await chapter_repo.get_by_ref(db, project.id, ref)
    if row is None:
        return None
    return {
        "word_count": row.word_count,
        "outline_status": row.outline_status,
        "status": row.status,
        "has_prose": row.has_prose,
        "confirmed_at": row.confirmed_at.isoformat() if row.confirmed_at else None,
        "archived_at": row.archived_at.isoformat() if row.archived_at else None,
    }
