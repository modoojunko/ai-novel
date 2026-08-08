"""启动迁移契约测试（ADR-004）：行缺失才迁 / 清空不复活 / 幂等 / 字符目录。

依赖 conftest 会话级临时库基座（建表完成）。用独立临时 root_path + 独立
user_id 隔离，不与其他测试的项目串数据。
"""

import asyncio
import json
import os
import tempfile

from db import async_session
from filesystem.db_storage import DatabaseFileBackend
from filesystem.migrate import backfill_tone_overrides, migrate_settings_to_db
from filesystem.paths import CHARACTER_DIR
from filesystem.storage import LocalFileBackend
from models.genre import Genre
from models.project import Novel


def _run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _tmp_root(prefix: str = "test_migrate_") -> str:
    return tempfile.mkdtemp(prefix=prefix)


async def _create_project(root_path: str) -> None:
    async with async_session() as session:
        session.add(
            Novel(
                user_id="mig-test-user",
                name=os.path.basename(root_path),
                slug=os.path.basename(root_path),
                root_path=root_path,
            )
        )
        await session.commit()


# ── 判据：行缺失才迁 ───────────────────────────────────────────────────────


def test_migrate_when_row_missing():
    root = _tmp_root()
    local = LocalFileBackend()
    db = DatabaseFileBackend()
    # 盘上有旧设定
    _run_async(
        local.write_yaml(root, "settings/writing-style.yaml", {"core_principles": ["a"]})
    )
    _run_async(_create_project(root))
    _run_async(migrate_settings_to_db())
    assert _run_async(db.read_yaml(root, "settings/writing-style.yaml")) == {
        "core_principles": ["a"]
    }
    # 磁盘文件保留（永不删文件）
    assert os.path.exists(os.path.join(root, "settings", "writing-style.yaml"))


def test_migrate_skips_existing_row_even_if_empty():
    """用户主动清空设定（行存在 content={}）→ 不被过期盘复活。"""
    root = _tmp_root()
    local = LocalFileBackend()
    db = DatabaseFileBackend()
    _run_async(db.write_yaml(root, "settings/writing-style.yaml", {}))  # 行存在、空
    _run_async(
        local.write_yaml(root, "settings/writing-style.yaml", {"core_principles": ["stale"]})
    )
    _run_async(_create_project(root))
    _run_async(migrate_settings_to_db())
    assert _run_async(db.read_yaml(root, "settings/writing-style.yaml")) == {}


def test_migrate_idempotent():
    root = _tmp_root()
    local = LocalFileBackend()
    db = DatabaseFileBackend()
    _run_async(local.write_yaml(root, "settings/hooks.yaml", {"active": [{"id": "h1"}]}))
    _run_async(_create_project(root))
    _run_async(migrate_settings_to_db())
    _run_async(migrate_settings_to_db())
    assert _run_async(db.read_yaml(root, "settings/hooks.yaml")) == {"active": [{"id": "h1"}]}


def test_migrate_characters():
    root = _tmp_root()
    local = LocalFileBackend()
    db = DatabaseFileBackend()
    _run_async(local.write_yaml(root, f"{CHARACTER_DIR}/hero.yaml", {"name": "Hero"}))
    _run_async(_create_project(root))
    _run_async(migrate_settings_to_db())
    assert _run_async(db.list_dir(root, CHARACTER_DIR)) == ["hero.yaml"]
    assert _run_async(db.read_yaml(root, f"{CHARACTER_DIR}/hero.yaml")) == {"name": "Hero"}


def test_migrate_no_projects_no_error():
    _run_async(migrate_settings_to_db())  # 空库不报错


# ── ADR-007 回填：题材 tone_overrides → 文风 tone ─────────────────────────


async def _insert_genre(**kwargs) -> None:
    defaults = {
        "id": "backfill-genre",
        "name": "回填题材",
        "description": "",
        "category": "urban",
        "narrator_role": "",
        "tone_blueprint": "{}",
        "taboos": "[]",
        "prompt_injection": "",
        "genre_config": "{}",
        "story_arc_templates": "[]",
        "is_preset": False,
    }
    defaults.update(kwargs)
    async with async_session() as session:
        session.add(Genre(**defaults))
        await session.commit()


def test_backfill_tone_overrides():
    """style 无 tone → 题材 toneBlueprint + tone_overrides 回填到文风 tone（列表化）。"""
    root = _tmp_root("test_backfill_")
    db = DatabaseFileBackend()
    _run_async(
        _insert_genre(
            narrator_role="贴近主角的第三人称",
            tone_blueprint=json.dumps(
                {
                    "defaultTone": "温暖",
                    "atmosphereOptions": ["默认氛围", "热闹"],
                    "povOptions": ["第一人称"],
                    "techniqueTags": ["细节"],
                },
                ensure_ascii=False,
            ),
        )
    )
    _run_async(_create_project(root))
    _run_async(db.write_yaml(root, "settings/writing-style.yaml", {"role": "一位小说家"}))
    _run_async(
        db.write_yaml(
            root,
            "settings/genre.yaml",
            {"genre_id": "backfill-genre", "tone_overrides": {"atmosphere": "自定义氛围"}},
        )
    )
    _run_async(backfill_tone_overrides())
    style = _run_async(db.read_yaml(root, "settings/writing-style.yaml"))
    assert style["role"] == "一位小说家"  # 其余键保留
    assert style["narrator_role"] == "贴近主角的第三人称"
    tone = style["tone"]
    assert tone["default_tone"] == "温暖"
    assert tone["atmosphere"] == ["自定义氛围"]  # override 优先，且字符串→列表
    assert tone["pov"] == ["第一人称"]  # 未覆盖用 blueprint options
    assert tone["techniques"] == ["细节"]


def test_backfill_skips_when_tone_already_present():
    """style 已有 tone（新模板/已回填）→ 不覆盖。"""
    root = _tmp_root("test_backfill_skip_")
    db = DatabaseFileBackend()
    _run_async(_insert_genre(id="skip-genre", tone_blueprint='{"defaultTone": "旧"}'))
    _run_async(_create_project(root))
    _run_async(
        db.write_yaml(root, "settings/writing-style.yaml", {"tone": {"default_tone": "新"}})
    )
    _run_async(
        db.write_yaml(
            root, "settings/genre.yaml", {"genre_id": "skip-genre", "tone_overrides": {}}
        )
    )
    _run_async(backfill_tone_overrides())
    style = _run_async(db.read_yaml(root, "settings/writing-style.yaml"))
    assert style["tone"] == {"default_tone": "新"}


def test_backfill_no_genre_id_skips():
    """genre.yaml 无 genre_id → 跳过（不写 tone）。"""
    root = _tmp_root("test_backfill_nogenre_")
    db = DatabaseFileBackend()
    _run_async(_create_project(root))
    _run_async(db.write_yaml(root, "settings/writing-style.yaml", {"role": "一位小说家"}))
    _run_async(db.write_yaml(root, "settings/genre.yaml", {"genre_id": ""}))
    _run_async(backfill_tone_overrides())
    style = _run_async(db.read_yaml(root, "settings/writing-style.yaml"))
    assert "tone" not in style
