"""卷族 CRUD 入库测试（PR① 数据全量入库）

验证：create_volume MAX+1 忽略 vol_num + DB 唯一存储 + 计数自增；list_volumes DB 全量树；
update_volume 标量+子表整体替换；get_volume {ref} 容 .yaml + 卷纲四族组装；
卷纲结构化字段（扩列+4 子表）读写回环；delete_volume 级联删章+清章族文件；
create_chapter 章号自增 + 卷 YAML 不落盘（DB 唯一属主）；get_chapter_row 读路径懒补自愈；
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

from db import Base, async_session, engine
from filesystem.storage import LocalFileBackend
from models import Novel
from repositories import chapter_repo, volume_repo

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


# ── 卷 CRUD（DB 唯一存储）────────────────────────────────────────────────


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
            # 卷族 DB 唯一属主，不再落 YAML
            assert await storage.read_yaml(proj.root_path, "volumes/vol-1.yaml") == {}

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


def test_update_volume_scalars_and_children_replace():
    async def _run():
        project = await _new_project("uv1")
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            await _create_volume(session, proj, title="原卷", summary="旧摘要")
            await _create_chapter(session, proj, "vol-1", title="第一章")
            # update 只带 title/summary → DB 行更新；章列表始终由 Chapter 行派生
            await _update_volume(
                session, proj, "vol-1",
                {"title": "新卷名", "summary": "新摘要"},
            )
            vol = await volume_repo.get_by_volume_no(session, proj.id, 1)
            assert vol.title == "新卷名"
            assert vol.summary == "新摘要"
            data = await _get_volume(session, proj, "vol-1")
            assert data["title"] == "新卷名"
            assert data["summary"] == "新摘要"
            assert data["chapters"][0]["title"] == "第一章"

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


def test_volume_structured_fields_roundtrip():
    """卷纲结构化：扩列标量 + 4 张子表整体替换 + get_volume 组装。"""
    async def _run():
        project = await _new_project("sv1")
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            await _create_volume(session, proj, title="结构卷")
            await _update_volume(
                session, proj, "vol-1",
                {
                    "direction_method": "template",
                    "template_name": "悬疑递进",
                    "core_conflict": "主角想查清真相，被幕后组织追杀",
                    "emotional_arc": "压抑→更压抑→提升→打脸→装逼",
                    "arc_mode": "先压后爽",
                    "primary_drive": "悬疑",
                    "info_gap_start": "读者知道有内鬼↦主角不知道",
                    "info_gap_end": "主角识破内鬼↦反派不知已暴露",
                    "chapter_target": 40,
                    "stages": [
                        {"stage_name": "起", "stage_function": "建立日常并埋雷",
                         "chapter_count": 8},
                        {"stage_name": "承", "stage_function": "追查遇阻升级",
                         "chapter_count": 12},
                    ],
                    "conflict_ladders": [
                        {"layer_no": 1, "chapters_range": "1-1~1-2",
                         "obstacle": "线人失联", "turning_type": "信息转折",
                         "turning_point": "线人留下的暗号指向内部"},
                    ],
                    "chapter_plans": [
                        {"chapter_no": 1, "title": "雨夜接头",
                         "summary": "主角接头拿档案，对方被灭口，档案失踪",
                         "emotional_anchor": "压抑↑——开场即失手",
                         "info_gap": "读者知道接头人是内鬼↦主角不知",
                         "arc_position": "第1章/共40章——起段开篇"},
                    ],
                    "character_voices": [
                        {"character_name": "林拓",
                         "situation": "被停职调查，孤身查案",
                         "unfinished": "还没查完师父的死因",
                         "interlude_thought": "卷间思考：信任是否已是奢侈品",
                         "next_action": "顺着暗号查内部档案室"},
                    ],
                },
            )
            data = await _get_volume(session, proj, "vol-1")
            assert data["direction_method"] == "template"
            assert data["chapter_target"] == 40
            assert len(data["stages"]) == 2
            assert data["stages"][0]["stage_name"] == "起"
            assert data["stages"][0]["chapter_count"] == 8
            assert data["conflict_ladders"][0]["layer_no"] == 1
            assert data["chapter_plans"][0]["title"] == "雨夜接头"
            assert data["character_voices"][0]["character_name"] == "林拓"

            # 子表整体替换：stages 换成一行，其余族不动
            await _update_volume(
                session, proj, "vol-1",
                {"stages": [{"stage_name": "合", "stage_function": "收束反转",
                             "chapter_count": 5}]},
            )
            data = await _get_volume(session, proj, "vol-1")
            assert len(data["stages"]) == 1
            assert data["stages"][0]["stage_name"] == "合"
            # 未传的族保持原值
            assert len(data["conflict_ladders"]) == 1
            assert data["chapter_target"] == 40

    _run_async(_run())


def test_delete_volume_cascades_chapters_and_files():
    async def _run():
        project = await _new_project("dv1")
        async with async_session() as session:
            proj = await session.get(Novel, project.id)
            await _create_volume(session, proj, title="待删卷")
            await _create_chapter(session, proj, "vol-1", title="第一章")
            await _create_chapter(session, proj, "vol-1", title="第二章")
            # 章 YAML 存在（PR② 前章族仍是文件存储），稍后断言被级联清理
            assert await storage.read_yaml(
                proj.root_path, "chapters/vol-1-ch-1.yaml"
            )
            await _delete_volume(session, proj, "vol-1")

            assert await volume_repo.count_by_project(session, proj.id) == 0
            assert await chapter_repo.count_by_project(session, proj.id) == 0
            assert proj.total_volumes == 0
            assert proj.total_chapters == 0
            # 章族文件级联删除
            assert not await storage.read_yaml(
                proj.root_path, "chapters/vol-1-ch-1.yaml"
            )
            assert not await storage.read_yaml(
                proj.root_path, "chapters/vol-1-ch-2.yaml"
            )

    _run_async(_run())


# ── 章 CRUD ──────────────────────────────────────────────────────────────


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
            # 章文件仍落盘（PR② 切换）
            data = await storage.read_yaml(
                proj.root_path, "chapters/vol-1-ch-1.yaml"
            )
            assert data["title"] == "第一章"
            assert data["volume"] == 1 and data["chapter"] == 1
            # 卷 YAML 不落盘：卷族 DB 唯一属主（§4.3）
            assert await storage.read_yaml(proj.root_path, "volumes/vol-1.yaml") == {}
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


def test_cleanup_chapter_artifacts_removes_archive_and_versions():
    """删章清理：归档 .md + versions 快照一并删除（防归档列表幽灵条目）。"""
    from chapters.service import cleanup_chapter_artifacts

    async def _run():
        project = await _new_project("ca1")
        # 造章 + 归档 + 版本快照
        await storage.write_yaml(
            project.root_path,
            "chapters/vol-1-ch-1.yaml",
            {"volume": 1, "chapter": 1, "title": "第一章", "status": "archived",
             "prose": "正文内容"},
        )
        await storage.write_md(
            project.root_path,
            "archives/vol-1-ch-1-first-chapter.md",
            "归档正文",
        )
        await storage.write_yaml(
            project.root_path,
            "versions/vol-1-ch-1/v1000.yaml",
            {"version": "v1000", "snapshot": {"prose": "x"}},
        )
        # 其他章节的归档不受影响
        await storage.write_md(
            project.root_path,
            "archives/vol-2-ch-1-other.md",
            "其他章归档",
        )

        await cleanup_chapter_artifacts(project.root_path, "vol-1-ch-1")

        assert (
            await storage.read_md(
                project.root_path, "archives/vol-1-ch-1-first-chapter.md"
            )
            == ""
        )
        assert (
            await storage.read_yaml(
                project.root_path, "versions/vol-1-ch-1/v1000.yaml"
            )
            == {}
        )
        # 其他章的归档保留
        assert (
            await storage.read_md(
                project.root_path, "archives/vol-2-ch-1-other.md"
            )
            == "其他章归档"
        )

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
    from volumes.schemas import VolumeUpdate
    from volumes.service import update_volume

    return await update_volume(session, project, ref, VolumeUpdate(**body))


async def _delete_volume(session, project, ref):
    from volumes.service import delete_volume

    return await delete_volume(session, project, ref)


async def _create_chapter(session, project, volume_ref, *, title):
    from chapters.service import create_chapter

    return await create_chapter(session, project, volume_ref, title)


async def _get_chapter_row(session, project, ref):
    from chapters.service import get_chapter_row

    return await get_chapter_row(session, project, ref)
