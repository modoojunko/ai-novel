"""卷/章数据底座回填（change 005）：volumes/vol-N.yaml + chapters/*.yaml → DB 行。

- 幂等 run-once：`project.index_status != "done"` 才跑；判据 + INSERT-if-missing 双保险。
- 只增不删：文件被新写路径删除的孤儿 DB 行不清理。
- 内嵌列表 word_count 不可信，以 `chapters/{ref}.yaml` 为准。
- reindex_project(project_id) 强制重扫（导入场景），不受 index_status 限制。
"""

import logging
import re

from sqlalchemy import select

from db import async_session
from filesystem.storage import get_storage
from models.project import Novel
from novels.service import count_chars
from repositories import chapter_repo, volume_repo

logger = logging.getLogger("uvicorn.error")

# volumes/vol-1.yaml → 1
_VOLUME_RE = re.compile(r"^vol-(\d+)$")
# chapters/vol-1-ch-1.yaml → (1, 1)
_CHAPTER_RE = re.compile(r"^vol-(\d+)-ch-(\d+)$")


def _parse_ref(ref: str) -> tuple[int, int] | None:
    """'vol-{vol_no}-ch-{chapter}' → (vol_no, chapter)；不匹配返 None。"""
    m = _CHAPTER_RE.match(ref)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def _derive_outline_status(status: str, prose: str) -> str:
    if status == "confirmed":
        return "confirmed"
    if (prose or "").strip():
        return "in_progress"
    return "unfilled"


async def _scan_project(root: str, *, force: bool = False) -> None:
    """扫描单项目根目录 → 卷/章行 + 自愈计数；commit 一次。"""
    async with async_session() as session:
        result = await session.execute(select(Novel).where(Novel.root_path == root))
        project = result.scalar_one_or_none()
        if project is None:
            return
        if not force and project.index_status == "done":
            return  # run-once 判据

        storage = get_storage()
        project_id = project.id

        # ── 1. 扫描 volumes/vol-N.yaml ───────────────────────────────
        vol_files = await storage.list_dir(root, "volumes")
        for f in sorted(vol_files):
            if not f.endswith(".yaml"):
                continue
            stem = f[: -len(".yaml")]
            m = _VOLUME_RE.match(stem)
            if not m:
                continue
            vol_no = int(m.group(1))
            vol_data = await storage.read_yaml(root, f"volumes/{f}")
            title = (vol_data or {}).get("title") or f"导入卷 {vol_no}"
            vol = await volume_repo.upsert(
                session, project_id, vol_no, title=title,
                summary=(vol_data or {}).get("summary", "") or "",
            )

            # ── 2. 内嵌 chapters 列表 → 章行（以 chapters/{ref}.yaml 为准）─
            chapters = (vol_data or {}).get("chapters") or []
            for ch in chapters:
                chapter = ch.get("chapter")
                if not isinstance(chapter, int):
                    continue
                ref = f"vol-{vol_no}-ch-{chapter}"
                await _upsert_chapter_from_yaml(
                    session, storage, root, project_id, vol.id, vol_no, chapter, ref, ch
                )

            # 自愈卷计数
            vol.chapter_count = len(chapters)

        # ── 3. 孤儿章文件兜底（DB 无行且无对应卷行 → 建占位卷 + 章）──
        chapter_files = await storage.list_dir(root, "chapters")
        for f in sorted(chapter_files):
            parsed = _parse_ref(f.removesuffix(".yaml"))
            if parsed is None:
                continue
            vol_no, chapter = parsed
            ref = f"vol-{vol_no}-ch-{chapter}"
            if await chapter_repo.has(session, project_id, ref):
                continue
            vol = await volume_repo.get_by_volume_no(session, project_id, vol_no)
            if vol is None:
                vol = await volume_repo.ensure_volume_row(
                    session, project_id, vol_no, title=f"导入卷 {vol_no}"
                )
            await _upsert_chapter_from_yaml(
                session, storage, root, project_id, vol.id, vol_no, chapter, ref, {}
            )

        # ── 4. 自愈冗余计数 + 标记 done ───────────────────────────────
        project.total_volumes = await volume_repo.count_by_project(session, project_id)
        project.total_chapters = await chapter_repo.count_by_project(session, project_id)
        project.index_status = "done"
        await session.commit()


async def _upsert_chapter_from_yaml(
    session, storage, root, project_id, volume_id, vol_no, chapter, ref, embedded
) -> None:
    """读 chapters/{ref}.yaml 回填章行；章文件缺失 → 占位行（内嵌 title）。"""
    data = await storage.read_yaml(root, f"chapters/{ref}.yaml") or {}
    if not data:
        # 卷内引用但无章文件 → 占位章行（title 取内嵌项，word_count=0）
        title = (embedded or {}).get("title") or f"第{chapter}章"
        existing = await chapter_repo.get_by_ref(session, project_id, ref)
        await chapter_repo.upsert(
            session, project_id, volume_id, chapter_no=chapter, ref=ref,
            title=title, status="outline", word_count=0, has_prose=False,
            outline_status="unfilled",
            confirmed_at=existing.confirmed_at if existing else None,
            archived_at=existing.archived_at if existing else None,
        )
        return

    title = data.get("title") or (embedded or {}).get("title") or f"第{chapter}章"
    status = data.get("status") or "outline"
    prose = data.get("prose") or ""
    word_count = count_chars(prose)
    has_prose = bool(prose.strip())
    outline_status = _derive_outline_status(status, prose)
    existing = await chapter_repo.get_by_ref(session, project_id, ref)
    # confirmed/archived 时间戳幂等：已有值保留，不因重扫刷新
    confirmed_at = existing.confirmed_at if existing else None
    archived_at = existing.archived_at if existing else None
    if confirmed_at is None and status == "confirmed":
        confirmed_at = existing.created_at if existing else None
    if archived_at is None and status == "archived":
        archived_at = existing.created_at if existing else None

    await chapter_repo.upsert(
        session, project_id, volume_id, chapter_no=chapter, ref=ref,
        title=title, status=status, word_count=word_count, has_prose=has_prose,
        outline_status=outline_status,
        confirmed_at=confirmed_at, archived_at=archived_at,
    )


async def _all_project_root_paths() -> list[str]:
    async with async_session() as session:
        result = await session.execute(select(Novel.root_path))
        return list(result.scalars().all())


async def index_volumes_chapters() -> None:
    """全量回填：枚举所有项目根目录，逐项目幂等扫描（失败不阻塞启动）。"""
    for root in await _all_project_root_paths():
        try:
            await _scan_project(root)
        except Exception:
            logger.warning(
                "index volumes/chapters failed for %s", root, exc_info=True
            )


async def reindex_project(project_id: str) -> None:
    """per-project 强制重扫（导入场景，即使 index_status 已 done）。"""
    async with async_session() as session:
        project = await session.get(Novel, project_id)
        if project is None:
            return
        root = project.root_path
    await _scan_project(root, force=True)
