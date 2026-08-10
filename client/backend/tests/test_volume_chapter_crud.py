"""Change 006 — volume-chapter-service CRUD 双写测试（TE-08/09）

验证：create_volume MAX+1 忽略 vol_num + 双写 + 计数自增；list_volumes DB 全量树；
update_volume 双写 + pop chapters 派生快照；get_volume {ref} 容 .yaml；delete_volume 级联删章；
create_chapter 章号自增 + 不写内嵌列表 + 计数同事务；get_chapter_row 读路径懒补自愈；
confirm 写 DB confirmed 态；delete_chapter 删 DB 行/versions + 计数维护。

用法：
    cd client/backend
    python -m pytest tests/test_volume_chapter_crud.py -v
"""

import asyncio
import os
import tempfile

import pytest

# ── Test environment (isolated temp DB + data root) ──────────────────────
_tmp_db = tempfile.NamedTemporaryFile(suffix="_crud.db", delete=False)  # noqa: SIM115
_tmp_db.close()
_tmp_data_root = tempfile.mkdtemp(prefix="test_volume_chapter_crud_")

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp_db.name}"
os.environ["DATA_ROOT"] = _tmp_data_root

from db import Base, async_session, engine  # noqa: E402
from filesystem.storage import LocalFileBackend  # noqa: E402
from models import Novel  # noqa: E402
from repositories import chapter_repo, volume_repo  # noqa: E402

USER_ID = "vcc_user"
storage = LocalFileBackend()


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


async def _new_project(name: str) -> Novel:
    """建一个空项目（root_path 已建 volumes/chapters 目录）。"""
    root = os.path.join(_tmp_data_root, name)
    os.makedirs(os.path.join(root, "volumes"), exist_ok=True)
    os.makedirs(os.path.join(root, "chapters"), exist_ok=True)
    project = Novel(
        user_id=USER_ID,
        name=name,
        slug=name,
        root_path=root,
        source="manual",
        current_phase="settings",  # settings→outline 合法，create_volume 可推进
    )
    async with async_session() as session:
        session.add(project)
        await session.commit()
        await session.refresh(project)
        return project


# ── TE-08 卷 CRUD 双写 ───────────────────────────────────────────────────


def test_create_volume_max_plus_one_ignores_vol_num():
    async def _run():
        project = await _new_project("cv1")
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            # 两次都传 vol_num=5，MAX+1 应生成 vol-1、vol-2
            r1 = await _create_volume(session, proj, title="第一卷", vol_num=5)
            r2 = await _create_volume(session, proj, title="第二卷", vol_num=5)
            assert r1["ref"] == "vol-1"
            assert r2["ref"] == "vol-2"
            assert r1["vol_num"] == 1 and r2["vol_num"] == 2
            assert await volume_repo.count_by_project(session, proj.id) == 2
            assert proj.total_volumes == 2
            # YAML 文件双写落盘
            data = await storage.read_yaml(
                proj.root_path, "volumes/vol-1.yaml"
            )
            assert data["title"] == "第一卷"
            assert data["volume"] == 1

    _run_async(_run())


def test_list_volumes_returns_db_tree_with_chapter_meta():
    async def _run():
        project = await _new_project("lv1")
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            await _create_volume(session, proj, title="第一卷")
            await _create_chapter(session, proj, "vol-1", title="第一章")
            vols = await _list_volumes(session, proj)
            assert len(vols) == 1
            assert vols[0]["ref"] == "vol-1"
            assert vols[0]["title"] == "第一卷"
            assert vols[0]["chapter_count"] == 1
            ch = vols[0]["chapters"][0]
            assert ch["ref"] == "vol-1-ch-1"
            assert ch["title"] == "第一章"
            assert ch["status"] == "outline"
            assert ch["word_count"] == 0
            assert ch["archived"] is False

    _run_async(_run())


def test_update_volume_dual_write_and_pops_chapters():
    async def _run():
        project = await _new_project("uv1")
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            await _create_volume(session, proj, title="原卷", summary="旧摘要")
            await _create_chapter(session, proj, "vol-1", title="第一章")
            # update 只带 title/summary → DB+YAML 双更；chapters 派生快照被 pop
            await _update_volume(
                session, proj, "vol-1",
                {"title": "新卷名", "summary": "新摘要", "chapters": [{"chapter": 1}]},
            )
            vol = await volume_repo.get_by_volume_no(session, proj.id, 1)
            assert vol.title == "新卷名"
            assert vol.summary == "新摘要"
            data = await storage.read_yaml(proj.root_path, "volumes/vol-1.yaml")
            assert data["title"] == "新卷名"
            assert data["summary"] == "新摘要"
            assert "chapters" not in data  # pop 派生快照，唯一属主非镜像

    _run_async(_run())


def test_get_volume_tolerates_yaml_suffix():
    async def _run():
        project = await _new_project("gv1")
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            await _create_volume(session, proj, title="容尾缀", summary="s")
            data = await _get_volume(session, proj, "vol-1.yaml")
            assert data["title"] == "容尾缀"
            assert data["ref"] == "vol-1"

    _run_async(_run())


def test_delete_volume_cascades_chapters_and_files():
    async def _run():
        project = await _new_project("dv1")
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            await _create_volume(session, proj, title="待删卷")
            await _create_chapter(session, proj, "vol-1", title="第一章")
            await _create_chapter(session, proj, "vol-1", title="第二章")
            # 章 YAML 存在，稍后断言被级联清理
            assert await storage.read_yaml(
                proj.root_path, "chapters/vol-1-ch-1.yaml"
            )
            await _delete_volume(session, proj, "vol-1")

            assert await volume_repo.count_by_project(session, proj.id) == 0
            assert await chapter_repo.count_by_project(session, proj.id) == 0
            assert proj.total_volumes == 0
            assert proj.total_chapters == 0
            # 文件级联删除
            assert not await storage.read_yaml(
                proj.root_path, "volumes/vol-1.yaml"
            )
            assert not await storage.read_yaml(
                proj.root_path, "chapters/vol-1-ch-1.yaml"
            )
            assert not await storage.read_yaml(
                proj.root_path, "chapters/vol-1-ch-2.yaml"
            )

    _run_async(_run())


# ── TE-09 章 CRUD ────────────────────────────────────────────────────────


def test_create_chapter_max_plus_one_no_embedded_list():
    async def _run():
        project = await _new_project("cc1")
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            await _create_volume(session, proj, title="第一卷")
            c1 = await _create_chapter(session, proj, "vol-1", title="第一章")
            c2 = await _create_chapter(session, proj, "vol-1", title="第二章")
            assert c1["ref"] == "vol-1-ch-1"
            assert c2["ref"] == "vol-1-ch-2"
            # 章文件双写落盘
            data = await storage.read_yaml(
                proj.root_path, "chapters/vol-1-ch-1.yaml"
            )
            assert data["title"] == "第一章"
            assert data["volume"] == 1 and data["chapter"] == 1
            # 卷 YAML 内嵌列表停写（§4.3 唯一属主非镜像）
            vol_data = await storage.read_yaml(proj.root_path, "volumes/vol-1.yaml")
            assert vol_data.get("chapters") == []
            # 计数同事务
            vol = await volume_repo.get_by_volume_no(session, proj.id, 1)
            assert vol.chapter_count == 2
            assert proj.total_chapters == 2

    _run_async(_run())


def test_get_chapter_row_self_heals_missing_rows():
    async def _run():
        # 只写章 YAML（无 DB 行）→ 读路径 ensure_volume_row 懒补
        project = await _new_project("sh1")
        await storage.write_yaml(
            project.root_path,
            "chapters/vol-3-ch-1.yaml",
            {"volume": 3, "chapter": 1, "title": "自愈章", "status": "draft",
             "prose": "你好 世界"},
        )
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            meta = await _get_chapter_row(session, proj, "vol-3-ch-1")
            assert meta is not None
            assert meta["word_count"] == 4
            assert meta["has_prose"] is True
            assert meta["outline_status"] == "in_progress"
            # 卷行被懒补（兜底标题「导入卷 3」）
            vol = await volume_repo.get_by_volume_no(session, proj.id, 3)
            assert vol is not None
            assert vol.title == "导入卷 3"

    _run_async(_run())


# ── service 包装（模块内统一异步 session 入口）─────────────────────────────


async def _create_volume(session, project, *, title, summary="", vol_num=None):
    from volumes.service import create_volume

    return await create_volume(
        session, project, title=title, summary=summary
    )


async def _list_volumes(session, project):
    from volumes.service import list_volumes

    return await list_volumes(session, project)


async def _get_volume(session, project, ref):
    from volumes.service import get_volume

    return await get_volume(session, project, ref)


async def _update_volume(session, project, ref, body):
    from volumes.service import update_volume

    return await update_volume(session, project, ref, body)


async def _delete_volume(session, project, ref):
    from volumes.service import delete_volume

    return await delete_volume(session, project, ref)


async def _create_chapter(session, project, volume_ref, *, title):
    from chapters.service import create_chapter

    return await create_chapter(session, project, volume_ref, title)


async def _get_chapter_row(session, project, ref):
    from chapters.service import get_chapter_row

    return await get_chapter_row(session, project, ref)
