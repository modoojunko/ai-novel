"""VolumeService — 卷 CRUD 双写（YAML 先写、DB 后更；change 006）。

- list_volumes：DB 查询全量卷+章树元数据（含 has_prose/outline_status/archived），
  不做正文过滤（N1 过滤在前端）。接入 GET /volumes（breaking change，前端同 commit 迁移）。
- create_volume：MAX(volume_no)+1（忽略 body.vol_num）+ tier_or_gate + 双写 + 计数自增。
- update_volume：title/summary 双写 DB+YAML；其余 key（PRO 卷纲）只写 YAML；pop chapters 清派生快照。
- delete_volume：删 DB 行（CASCADE 删章）+ 删文件 + 计数维护。
- DB 写失败降级不 500（try/except + warning），DB 行由读路径自愈。
"""

import logging
from collections import defaultdict

from filesystem.storage import get_storage
from models.chapter import Chapter
from repositories import chapter_repo, volume_repo
from sqlalchemy import func, select
from workflow.engine import strip_suffix, update_phase
from workflow.gates import gate_settings_complete
from workflow.tier import tier_or_gate

logger = logging.getLogger("uvicorn.error")


async def list_volumes(db, project) -> list[dict]:
    """DB 全量树：一次拉卷 + 章，内存按 volume_id 分组（免 N+1）。"""
    vols = await volume_repo.list_by_project(db, project.id)
    chapters = await chapter_repo.list_by_project(db, project.id)
    by_vol: dict[str, list] = defaultdict(list)
    for c in chapters:
        by_vol[c.volume_id].append(c)

    result = []
    for v in vols:
        chs = by_vol.get(v.id, [])
        result.append(
            {
                "ref": f"vol-{v.volume_no}",
                "title": v.title,
                "summary": v.summary,
                "chapter_count": v.chapter_count,
                "chapters": [
                    {
                        "ref": c.ref,
                        "volume": v.volume_no,
                        "chapter": c.chapter_no,
                        "title": c.title,
                        "status": c.status,
                        "word_count": c.word_count,
                        "has_prose": c.has_prose,
                        "outline_status": c.outline_status,
                        "archived": c.status == "archived",
                    }
                    for c in sorted(chs, key=lambda x: x.chapter_no)
                ],
            }
        )
    return result


async def create_volume(
    db, project, *, title: str, summary: str = ""
) -> dict:
    """MAX+1（忽略 body.vol_num）+ 双写 + 计数自增。"""
    vol_no = await volume_repo.max_volume_no(db, project.id) + 1
    result = await tier_or_gate(db, project, gate_settings_complete, project.root_path)
    if result.hard_block and not result.valid:
        from fastapi import HTTPException

        raise HTTPException(400, f"Settings incomplete: {result.warnings}")

    update_phase(project, "outline")
    await get_storage().write_yaml(
        project.root_path,
        f"volumes/vol-{vol_no}.yaml",
        {"volume": vol_no, "title": title, "summary": summary, "chapters": []},
    )
    try:
        vol = await volume_repo.upsert(
            db, project.id, vol_no, title=title, summary=summary
        )
        project.total_volumes += 1  # 现状 `= vol_num` 覆盖式是 bug
        await db.commit()
        logger.info("created volume %s for project %s", vol_no, project.id)
    except Exception:
        # YAML 已落，DB 行由读路径自愈（GET 懒补 / 启动回填）；不 500
        logger.warning("create_volume DB write failed for %s", vol_no, exc_info=True)

    return {"vol_num": vol_no, "filename": f"vol-{vol_no}.yaml", "ref": f"vol-{vol_no}"}


async def get_volume(db, project, ref: str) -> dict:
    """DB 行元数据 + YAML 全字段合并返回；{ref} 容 .yaml。"""
    vol_no = int(strip_suffix(ref).replace("vol-", ""))
    vol = await volume_repo.get_by_volume_no(db, project.id, vol_no)
    data = await get_storage().read_yaml(
        project.root_path, f"volumes/vol-{vol_no}.yaml"
    ) or {}
    if vol is not None:
        data.setdefault("title", vol.title)
        data.setdefault("summary", vol.summary)
    data["ref"] = f"vol-{vol_no}"
    return data


async def update_volume(db, project, ref: str, body: dict) -> dict:
    """title/summary 双写 DB+YAML；其余 key 只写 YAML；pop chapters 清派生快照。"""
    vol_no = int(strip_suffix(ref).replace("vol-", ""))
    data = await get_storage().read_yaml(
        project.root_path, f"volumes/vol-{vol_no}.yaml"
    ) or {}
    for k, v in body.items():
        data[k] = v
    # 派生快照不入库、不留 YAML（§4.3 唯一属主非镜像）
    data.pop("chapters", None)

    title = body.get("title", data.get("title", f"vol-{vol_no}"))
    summary = body.get("summary", data.get("summary", ""))
    await get_storage().write_yaml(
        project.root_path, f"volumes/vol-{vol_no}.yaml", data
    )
    try:
        await volume_repo.upsert(
            db, project.id, vol_no, title=str(title), summary=str(summary or "")
        )
        await db.commit()
    except Exception:
        logger.warning("update_volume DB write failed for %s", vol_no, exc_info=True)
    return {"ok": True}


async def delete_volume(db, project, ref: str) -> dict:
    """删 DB 行（CASCADE 删章）→ 删 YAML/versions/archives → 计数维护。"""
    vol_no = int(strip_suffix(ref).replace("vol-", ""))
    vol = await volume_repo.get_by_volume_no(db, project.id, vol_no)
    storage = get_storage()

    deleted_chapters = 0
    if vol is not None:
        result = await db.execute(
            select(func.count(Chapter.id)).where(Chapter.volume_id == vol.id)
        )
        deleted_chapters = result.scalar() or 0

    # 文件清理
    await storage.delete_file(project.root_path, f"volumes/vol-{vol_no}.yaml")
    prefix = f"vol-{vol_no}-ch-"
    for f in await storage.list_dir(project.root_path, "chapters"):
        if f.startswith(prefix) and f.endswith(".yaml"):
            await storage.delete_file(project.root_path, f"chapters/{f}")
    for f in await storage.list_dir(project.root_path, "versions"):
        if f.startswith(prefix):
            await storage.delete_file(project.root_path, f"versions/{f}")
    for f in await storage.list_dir(project.root_path, "archives"):
        if f.startswith(f"vol-{vol_no}-"):
            await storage.delete_file(project.root_path, f"archives/{f}")

    try:
        if vol is not None:
            await db.delete(vol)  # ORM cascade 删章行（FK CASCADE 双保险）
        project.total_volumes = max(0, (project.total_volumes or 0) - 1)
        project.total_chapters = max(
            0, (project.total_chapters or 0) - deleted_chapters
        )
        await db.commit()
    except Exception:
        logger.warning("delete_volume DB write failed for %s", vol_no, exc_info=True)
    return {"ok": True}
