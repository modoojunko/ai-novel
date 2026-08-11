"""Change 005 — index-db-base 测试（TE-06 建表 + TE-07 幂等回填）

验证：volumes/chapters 表字段/约束/索引；projects.index_status 列；
count_chars 去空白口径；ensure_volume_row 懒补；幂等回填跑两遍行数不变；
内嵌 word_count=0 被章 YAML 真字数纠正；孤儿章占位卷；index_status='done' 不重扫。

用法：
    cd client/backend
    python -m pytest tests/test_volume_chapter_index.py -v
"""

import asyncio
import os
import tempfile

import pytest

# ── Test environment (isolated temp DB + data root) ──────────────────────
_tmp_db = tempfile.NamedTemporaryFile(suffix="_index.db", delete=False)  # noqa: SIM115
_tmp_db.close()
_tmp_data_root = tempfile.mkdtemp(prefix="test_volume_chapter_index_")

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp_db.name}"
os.environ["DATA_ROOT"] = _tmp_data_root

from db import Base, async_session, engine
from filesystem.index_volumes_chapters import (
    _scan_project,
    index_volumes_chapters,
    reindex_project,
)
from filesystem.storage import LocalFileBackend
from models import Chapter, Novel, Volume
from novels.service import count_chars
from repositories import chapter_repo, volume_repo

USER_ID = "vi_user"


def _run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@pytest.fixture(scope="session", autouse=True)
def _setup_db():
    _run_async(_create_tables())
    yield


async def _make_project(name: str, vol_files: list, chapter_files: list) -> Novel:
    """构造含 YAML 文件的存量项目：vol_files=[(vol_no, data)]；chapter_files=[(ref, data)]。"""
    root = os.path.join(_tmp_data_root, name)
    os.makedirs(os.path.join(root, "volumes"), exist_ok=True)
    os.makedirs(os.path.join(root, "chapters"), exist_ok=True)
    storage = LocalFileBackend()
    for vol_no, vol_data in vol_files:
        await storage.write_yaml(root, f"volumes/vol-{vol_no}.yaml", vol_data)
    for ref, data in chapter_files:
        await storage.write_yaml(root, f"chapters/{ref}.yaml", data)
    project = Novel(
        user_id=USER_ID,
        name=name,
        slug=name,
        root_path=root,
        source="import",
        current_phase="settings",
    )
    async with async_session() as session:
        session.add(project)
        await session.commit()
        await session.refresh(project)
        return project


async def _counts(project_id: str) -> tuple[int, int]:
    async with async_session() as session:
        vols = await volume_repo.count_by_project(session, project_id)
        chs = await chapter_repo.count_by_project(session, project_id)
        return vols, chs


# ── TE-06 建表 ────────────────────────────────────────────────────────────


def test_volumes_table_schema():
    cols = Volume.__table__.c
    assert Volume.__tablename__ == "volumes"
    for name in ("id", "project_id", "volume_no", "title", "summary", "chapter_count"):
        assert name in cols, f"missing column {name}"
    unique_names = {
        c.name for c in Volume.__table__.constraints if "Unique" in type(c).__name__
    }
    assert "uq_volumes_project_volume_no" in unique_names


def test_chapters_table_schema():
    cols = Chapter.__table__.c
    assert Chapter.__tablename__ == "chapters"
    for name in (
        "id",
        "project_id",
        "volume_id",
        "chapter_no",
        "ref",
        "title",
        "status",
        "word_count",
        "has_prose",
        "outline_status",
        "confirmed_at",
        "archived_at",
    ):
        assert name in cols, f"missing column {name}"
    unique_names = {
        c.name for c in Chapter.__table__.constraints if "Unique" in type(c).__name__
    }
    assert "uq_chapters_project_ref" in unique_names
    index_names = {i.name for i in Chapter.__table__.indexes}
    assert "ix_chapters_project_volume_status" in index_names
    # volume_id FK ondelete CASCADE（级联双保险）
    fk = Chapter.__table__.c.volume_id.foreign_keys
    assert fk and next(iter(fk)).ondelete == "CASCADE"


def test_projects_index_status_column():
    assert "index_status" in Novel.__table__.c


def test_create_all_includes_new_tables():
    from db import Base as B

    assert "volumes" in B.metadata.tables
    assert "chapters" in B.metadata.tables


# ── TE-07 count_chars / ensure_volume_row ─────────────────────────────────


def test_count_chars_strips_whitespace():
    assert count_chars("  你好 世界 \n abc") == 7  # 你好世界(4) + abc(3)
    assert count_chars("") == 0
    assert count_chars(None) == 0
    assert count_chars("  \n\t ") == 0


def test_ensure_volume_row_creates_missing_with_fallback_title():
    async def _run():
        async with async_session() as session:
            project = await _make_project("evr1", [], [])
            vol = await volume_repo.ensure_volume_row(
                session, project.id, 5, title="第一卷"
            )
            assert vol.title == "第一卷"
            vol2 = await volume_repo.ensure_volume_row(
                session, project.id, 5, title="第一卷"
            )
            assert vol2.id == vol.id  # 同行，不重复插入
            assert await volume_repo.count_by_project(session, project.id) == 1
            # 无 title → 兜底「导入卷 N」
            vol3 = await volume_repo.ensure_volume_row(session, project.id, 9)
            assert vol3.title == "导入卷 9"

    _run_async(_run())


def test_ensure_volume_row_returns_existing_as_is():
    async def _run():
        async with async_session() as session:
            project = await _make_project("evr2", [], [])
            vol = await volume_repo.upsert(
                session, project.id, 2, title="原卷", summary="s"
            )
            vol2 = await volume_repo.ensure_volume_row(session, project.id, 2)
            assert vol2.id == vol.id
            assert vol2.summary == "s"  # 不改动既有行

    _run_async(_run())


# ── TE-07 幂等回填 ───────────────────────────────────────────────────────


def test_backfill_two_runs_idempotent_and_corrects_word_count():
    async def _run():
        project = await _make_project(
            "bk1",
            [(1, {"volume": 1, "title": "第一卷", "summary": "", "chapters": [
                {"chapter": 1, "title": "第一章", "word_count": 0, "status": "draft"},
            ]})],
            [("vol-1-ch-1", {"volume": 1, "chapter": 1, "title": "第一章",
                              "status": "draft", "prose": "你好 世界"})],
        )
        await _scan_project(project.root_path)
        vols1, chs1 = await _counts(project.id)
        assert (vols1, chs1) == (1, 1)

        await _scan_project(project.root_path)
        vols2, chs2 = await _counts(project.id)
        assert (vols2, chs2) == (1, 1)  # 行数不变（幂等）

        # 内嵌 word_count=0 被章 YAML 真字数纠正；has_prose/outline_status 派生
        async with async_session() as session:
            ch = await chapter_repo.get_by_ref(session, project.id, "vol-1-ch-1")
            assert ch is not None
            assert ch.word_count == 4  # 你好世界
            assert ch.has_prose is True
            assert ch.outline_status == "in_progress"
            assert ch.title == "第一章"
            proj = await session.get(Novel, project.id)
            assert proj.index_status == "done"
            assert proj.total_volumes == 1
            assert proj.total_chapters == 1

    _run_async(_run())


def test_backfill_placeholder_chapter_without_yaml():
    async def _run():
        # 卷内引用但无章文件 → 占位章行（word_count=0）
        project = await _make_project(
            "bk2",
            [(1, {"volume": 1, "title": "第一卷", "chapters": [
                {"chapter": 1, "title": "无文件章", "word_count": 0},
            ]})],
            [],
        )
        await _scan_project(project.root_path)
        async with async_session() as session:
            ch = await chapter_repo.get_by_ref(session, project.id, "vol-1-ch-1")
            assert ch is not None
            assert ch.word_count == 0
            assert ch.title == "无文件章"

    _run_async(_run())


def test_backfill_orphan_chapter_creates_placeholder_volume():
    async def _run():
        # 孤儿章文件（无 volumes/vol-2.yaml）→ 建占位卷 + 章
        project = await _make_project(
            "bk3",
            [],
            [("vol-2-ch-1", {"volume": 2, "chapter": 1, "title": "孤儿章",
                              "status": "outline", "prose": "孤"})],
        )
        await _scan_project(project.root_path)
        vols, chs = await _counts(project.id)
        assert (vols, chs) == (1, 1)
        async with async_session() as session:
            vol = await volume_repo.get_by_volume_no(session, project.id, 2)
            assert vol is not None
            assert vol.title == "导入卷 2"
            ch = await chapter_repo.get_by_ref(session, project.id, "vol-2-ch-1")
            assert ch is not None
            assert ch.word_count == 1

    _run_async(_run())


def test_backfill_skips_when_index_status_done():
    async def _run():
        project = await _make_project(
            "bk4",
            [(1, {"volume": 1, "title": "第一卷", "chapters": [
                {"chapter": 1, "title": "第一章"},
            ]})],
            [("vol-1-ch-1", {"volume": 1, "chapter": 1, "title": "第一章",
                              "status": "outline", "prose": "x"})],
        )
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            proj.index_status = "done"
            await session.commit()
        await _scan_project(project.root_path)  # 非强制 → 跳过
        vols, chs = await _counts(project.id)
        assert (vols, chs) == (0, 0)

    _run_async(_run())


def test_reindex_project_forces_rescan_even_when_done():
    async def _run():
        project = await _make_project(
            "bk5",
            [(1, {"volume": 1, "title": "第一卷", "chapters": [
                {"chapter": 1, "title": "第一章"},
            ]})],
            [("vol-1-ch-1", {"volume": 1, "chapter": 1, "title": "第一章",
                              "status": "draft", "prose": "你好 世界"})],
        )
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            proj.index_status = "done"
            await session.commit()
        await reindex_project(project.id)  # 强制 → 导入场景可用
        vols, chs = await _counts(project.id)
        assert (vols, chs) == (1, 1)

    _run_async(_run())


def test_index_volumes_chapters_sweeps_all_projects():
    async def _run():
        p1 = await _make_project(
            "sweep1",
            [(1, {"volume": 1, "title": "卷一", "chapters": [
                {"chapter": 1, "title": "第一章"},
            ]})],
            [("vol-1-ch-1", {"volume": 1, "chapter": 1, "title": "第一章",
                              "status": "draft", "prose": "内容"})],
        )
        p2 = await _make_project(
            "sweep2",
            [(1, {"volume": 1, "title": "卷二", "chapters": [
                {"chapter": 1, "title": "第二章"},
            ]})],
            [("vol-1-ch-1", {"volume": 1, "chapter": 1, "title": "第二章",
                              "status": "outline", "prose": ""})],
        )
        await index_volumes_chapters()
        v1, c1 = await _counts(p1.id)
        v2, c2 = await _counts(p2.id)
        assert (v1, c1) == (1, 1)
        assert (v2, c2) == (1, 1)

    _run_async(_run())


def test_count_archived():
    async def _run():
        project = await _make_project("arc", [], [])
        async with async_session() as session:
            vol = await volume_repo.ensure_volume_row(session, project.id, 1, title="V")
            await chapter_repo.upsert(
                session, project.id, vol.id, chapter_no=1, ref="vol-1-ch-1",
                title="a", status="archived",
            )
            await chapter_repo.upsert(
                session, project.id, vol.id, chapter_no=2, ref="vol-1-ch-2",
                title="b", status="outline",
            )
            assert await chapter_repo.count_archived(session, project.id) == 1

    _run_async(_run())
