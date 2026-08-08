"""启动迁移契约测试（ADR-004）：行缺失才迁 / 清空不复活 / 幂等 / 字符目录。

依赖 conftest 会话级临时库基座（建表完成）。用独立临时 root_path + 独立
user_id 隔离，不与其他测试的项目串数据。
"""

import asyncio
import os
import tempfile

from db import async_session
from filesystem.db_storage import DatabaseFileBackend
from filesystem.migrate import migrate_settings_to_db
from filesystem.paths import CHARACTER_DIR
from filesystem.storage import LocalFileBackend
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
