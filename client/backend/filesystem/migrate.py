"""启动迁移：settings 盘→DB（ADR-004）+ tone_overrides 回填（ADR-007）。

判据 = 「行是否存在」——用户主动清空设定（行存在、content={}）不被过期盘复活。
枚举 novels root_path，对 PATH_TO_KEY 每项行缺失才用显式 LocalFileBackend 读盘
→ DatabaseFileBackend 写库（不复用 composite，防递归/幂等失效）。
磁盘文件 = 一次性快照，永不删文件；回滚走 export_settings_to_files。
backfill_tone_overrides 在 migrate_settings_to_db 之后调用：存量项目题材的
tone_overrides/toneBlueprint 一次性回填到 writing-style tone 块。
"""

import json

from sqlalchemy import select

from db import async_session
from filesystem.db_storage import DatabaseFileBackend
from filesystem.paths import CHARACTER_DIR, CHARACTER_PREFIX, PATH_TO_KEY
from filesystem.storage import LocalFileBackend
from models.genre import Genre
from models.project import Novel


def _json_loads(s: str | None, default):
    try:
        return json.loads(s) if s else default
    except (TypeError, ValueError):
        return default


def _as_list(v) -> list[str]:
    """字符串或字符串列表 → 非空字符串列表；缺失/其他 → []（tone 值统一列表化）。"""
    if isinstance(v, str):
        return [v] if v.strip() else []
    if isinstance(v, list):
        return [str(x) for x in v if x and str(x).strip()]
    return []


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


async def backfill_tone_overrides() -> None:
    """ADR-007 一次性回填：题材 tone_overrides/toneBlueprint → writing-style tone。

    仅当 style 尚无 tone 键时才写入（新项目模板自带 tone，不覆盖；migrate 后
    style 行必然存在）。genre_id 缺失或定义缺失 → 跳过。tone 值统一规范化为
    列表，渲染层（build_tone_section）与前端表单对双态安全。
    """
    db = DatabaseFileBackend()
    for root in await _all_project_root_paths():
        style = await db.read_yaml(root, "settings/writing-style.yaml")
        if not isinstance(style, dict) or "tone" in style:
            continue
        genre_cfg = await db.read_yaml(root, "settings/genre.yaml") or {}
        genre_id = genre_cfg.get("genre_id")
        if not genre_id:
            continue
        async with async_session() as session:
            row = await session.get(Genre, genre_id)
        if row is None:
            continue

        blueprint = _json_loads(row.tone_blueprint, {})
        overrides = genre_cfg.get("tone_overrides", {}) or {}
        style["narrator_role"] = row.narrator_role or ""
        style["tone"] = {
            "default_tone": blueprint.get("defaultTone", ""),
            "atmosphere": _as_list(
                overrides.get("atmosphere") or blueprint.get("atmosphereOptions", [])
            ),
            "pov": _as_list(overrides.get("pov") or blueprint.get("povOptions", [])),
            "techniques": _as_list(
                overrides.get("techniques") or blueprint.get("techniqueTags", [])
            ),
        }
        await db.write_yaml(root, "settings/writing-style.yaml", style)


async def export_settings_to_files(root_path: str) -> None:
    """回滚工具：DB settings 全量写回磁盘（不删 DB 行）。"""
    local = LocalFileBackend()
    db = DatabaseFileBackend()
    for relative_path in PATH_TO_KEY:
        data = await db.read_yaml(root_path, relative_path)
        if data:
            await local.write_yaml(root_path, relative_path, data)
    for filename in await db.list_dir(root_path, CHARACTER_DIR):
        data = await db.read_yaml(root_path, f"{CHARACTER_DIR}/{filename}")
        if data:
            await local.write_yaml(root_path, f"{CHARACTER_DIR}/{filename}", data)
