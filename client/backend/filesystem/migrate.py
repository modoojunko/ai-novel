"""启动迁移：settings 盘→DB（ADR-004）。

判据 = 「行是否存在」——用户主动清空设定（行存在、content={}）不被过期盘复活。
枚举 novels root_path，对 PATH_TO_KEY 每项行缺失才用显式 LocalFileBackend 读盘
→ DatabaseFileBackend 写库（不复用 composite，防递归/幂等失效）。
磁盘文件 = 一次性快照，永不删文件；回滚走 export_settings_to_files。
"""

from sqlalchemy import select

from db import async_session
from filesystem.db_storage import DatabaseFileBackend
from filesystem.paths import CHARACTER_DIR, CHARACTER_PREFIX, PATH_TO_KEY
from filesystem.storage import LocalFileBackend
from models.project import Novel


async def _all_project_root_paths() -> list[str]:
    async with async_session() as session:
        result = await session.execute(select(Novel.root_path))
        return list(result.scalars().all())


async def migrate_settings_to_db() -> None:
    """幂等迁移：DB 行缺失才从盘读入，已有行（含空 dict）一律不动。"""
    local = LocalFileBackend()
    db = DatabaseFileBackend()

    for root in await _all_project_root_paths():
        # 单文件设定
        for relative_path, key in PATH_TO_KEY.items():
            if await db.has_key(root, key):
                continue
            data = await local.read_yaml(root, relative_path)
            if data:
                await db.write_yaml(root, relative_path, data)
        # 字符目录
        for filename in await local.list_dir(root, CHARACTER_DIR):
            if not filename.endswith(".yaml"):
                continue
            key = CHARACTER_PREFIX + filename
            if await db.has_key(root, key):
                continue
            data = await local.read_yaml(root, f"{CHARACTER_DIR}/{filename}")
            if data:
                await db.write_yaml(root, f"{CHARACTER_DIR}/{filename}", data)


async def export_settings_to_files(root_path: str) -> None:
    """回滚工具：DB settings 全量写回磁盘（不删 DB 行）。"""
    local = LocalFileBackend()
    db = DatabaseFileBackend()
    for relative_path, _key in PATH_TO_KEY.items():
        data = await db.read_yaml(root_path, relative_path)
        if data:
            await local.write_yaml(root_path, relative_path, data)
    for filename in await db.list_dir(root_path, CHARACTER_DIR):
        data = await db.read_yaml(root_path, f"{CHARACTER_DIR}/{filename}")
        if data:
            await local.write_yaml(root_path, f"{CHARACTER_DIR}/{filename}", data)
