"""Genre library service — CRUD, seed, and writing-pipeline injection.

题材定义全局共享（C端 SQLite genres 表）。嵌套结构以 JSON 字符串存入 Text 列，
camelCase（前端 GenreDefinition 形状）↔ 模型列之间的转换集中在这里。

resolve_genre_context / build_genre_section 供写作链路（prompt/assembler.py 与
write/chapter_writer.py）复用：项目 settings/genre.yaml 里的 genre_id → 全局定义 →
合并项目 overrides → 渲染「## 题材设定」块。genre_id 为空或定义缺失时优雅降级
返回 None（不强制 genre_id 必须存在于库，存量项目/测试不破）。
"""

import json
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import async_session
from filesystem.storage import get_storage
from models.genre import Genre
from novels.service import list_projects

from .presets import PRESET_GENRES

GENRE_CATEGORIES = {"urban", "historical", "xianhuan", "suspense", "scifi", "independent"}
_ID_RE = re.compile(r"^[a-z][a-z0-9-]*$")


# ── Serialization ──────────────────────────────────────────────────────────


def _json_loads(s: str | None, default):
    try:
        return json.loads(s) if s else default
    except (TypeError, ValueError):
        return default


def _model_to_def(row: Genre) -> dict:
    """Genre ORM row → camelCase GenreDefinition dict (frontend shape)."""
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "category": row.category,
        "narratorRole": row.narrator_role,
        "typicalArc": row.typical_arc,
        "toneBlueprint": _json_loads(row.tone_blueprint, {}),
        "taboos": _json_loads(row.taboos, []),
        "promptInjection": row.prompt_injection,
        "genreConfig": _json_loads(row.genre_config, {}),
        "storyArcTemplates": _json_loads(row.story_arc_templates, []),
        "isPreset": bool(row.is_preset),
    }


def _def_to_model(data: dict) -> dict:
    """camelCase GenreDefinition dict → ORM column kwargs."""
    return {
        "id": data["id"],
        "name": data.get("name", ""),
        "description": data.get("description", ""),
        "category": data.get("category", ""),
        "narrator_role": data.get("narratorRole", ""),
        "typical_arc": data.get("typicalArc", ""),
        "tone_blueprint": json.dumps(data.get("toneBlueprint", {}), ensure_ascii=False),
        "taboos": json.dumps(data.get("taboos", []), ensure_ascii=False),
        "prompt_injection": data.get("promptInjection", ""),
        "genre_config": json.dumps(data.get("genreConfig", {}), ensure_ascii=False),
        "story_arc_templates": json.dumps(
            data.get("storyArcTemplates", []), ensure_ascii=False
        ),
    }


# ── Validation ─────────────────────────────────────────────────────────────


def validate_id(genre_id: str) -> str | None:
    """Return an error message, or None when the id is valid."""
    if not genre_id or not _ID_RE.match(genre_id):
        return "题材 id 只能由小写字母开头的小写字母/数字/短横线组成"
    return None


# ── Seed ───────────────────────────────────────────────────────────────────


async def ensure_seed_genres() -> None:
    """Insert preset genres that are missing (idempotent).

    只插缺失、绝不覆盖已存在的行——用户对预置题材的编辑被保留。启动时调用。
    """
    async with async_session() as session:
        for preset in PRESET_GENRES:
            existing = await session.get(Genre, preset["id"])
            if existing is None:
                session.add(Genre(id=preset["id"], **_def_to_model(preset), is_preset=True))
        await session.commit()


# ── CRUD ──────────────────────────────────────────────────────────────────


async def list_genres(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Genre).order_by(Genre.category, Genre.name))
    return [_model_to_def(r) for r in result.scalars().all()]


async def get_genre(db: AsyncSession, genre_id: str) -> dict | None:
    row = await db.get(Genre, genre_id)
    return _model_to_def(row) if row else None


async def create_genre(db: AsyncSession, data: dict) -> dict:
    """Create a custom genre. Raises ValueError on invalid id / duplicate id."""
    err = validate_id(data.get("id", ""))
    if err:
        raise ValueError(err)
    existing = await db.get(Genre, data["id"])
    if existing:
        raise ValueError("该题材 id 已存在")
    row = Genre(id=data["id"], **_def_to_model(data), is_preset=False)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _model_to_def(row)


async def update_genre(db: AsyncSession, genre_id: str, data: dict) -> dict | None:
    """Update a custom genre. Returns None if not found; presets are read-only."""
    row = await db.get(Genre, genre_id)
    if not row:
        return None
    if row.is_preset:
        raise ValueError("预置题材只读，可新建自定义题材替代")
    for k, v in _def_to_model({**data, "id": genre_id}).items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return _model_to_def(row)


async def delete_genre(db: AsyncSession, genre_id: str) -> bool | None:
    """Delete a custom genre. Returns True if deleted, None if not found."""
    row = await db.get(Genre, genre_id)
    if not row:
        return None
    if row.is_preset:
        raise ValueError("预置题材不可删除")
    await db.delete(row)
    await db.commit()
    return True


async def _find_referencing_projects(
    db: AsyncSession, user_id: str, genre_id: str
) -> list[str]:
    """Return names of projects whose settings/genre.yaml references genre_id."""
    projects = await list_projects(db, user_id)
    out = []
    for p in projects:
        cfg = await get_storage().read_yaml(p.root_path, "settings/genre.yaml") or {}
        if cfg.get("genre_id") == genre_id:
            out.append(p.name)
    return out


# ── Writing-pipeline injection ─────────────────────────────────────────────


async def resolve_genre_context(root_path: str) -> dict | None:
    """Resolve a project's genre config into a flat prompt-injection dict.

    Returns None when the project has no genre_id or the definition is missing
    (graceful degradation). Reads project settings/genre.yaml via storage, then
    looks up the definition in the DB.
    """
    genre_cfg = await get_storage().read_yaml(root_path, "settings/genre.yaml") or {}
    genre_id = genre_cfg.get("genre_id")
    if not genre_id:
        return None

    async with async_session() as session:
        row = await session.get(Genre, genre_id)
    if row is None:
        return None

    definition = _model_to_def(row)
    tone = definition.get("toneBlueprint", {})
    gcfg = definition.get("genreConfig", {})
    tone_overrides = genre_cfg.get("tone_overrides", {}) or {}
    cfg_overrides = genre_cfg.get("config_overrides", {}) or {}
    prompt_enabled = genre_cfg.get("prompt_injection_enabled", True)
    selected_arc_id = genre_cfg.get("selected_arc_id")

    arcs = definition.get("storyArcTemplates", [])
    selected_arc = None
    if selected_arc_id:
        selected_arc = next((a for a in arcs if a.get("id") == selected_arc_id), None)
    if selected_arc is None and arcs:
        selected_arc = arcs[0]

    return {
        "id": genre_id,
        "name": definition.get("name", genre_id),
        "category": definition.get("category", ""),
        "description": definition.get("description", ""),
        "narrator_role": definition.get("narratorRole", ""),
        "typical_arc": definition.get("typicalArc", ""),
        "taboos": definition.get("taboos", []),
        "default_tone": tone.get("defaultTone", ""),
        "atmosphere": tone_overrides.get("atmosphere") or tone.get("atmosphereOptions", []),
        "pov": tone_overrides.get("pov") or tone.get("povOptions", []),
        "techniques": tone_overrides.get("techniques") or tone.get("techniqueTags", []),
        "prompt_injection": (
            definition.get("promptInjection", "") if prompt_enabled else None
        ),
        "fulfillment_types": (
            cfg_overrides.get("fulfillment_types") or gcfg.get("fulfillmentTypes", [])
        ),
        "chapter_types": (
            cfg_overrides.get("chapter_types") or gcfg.get("chapterTypes", [])
        ),
        "pacing_rules": (
            cfg_overrides.get("pacing_rules") or gcfg.get("pacingRules", [])
        ),
        "fatigue_words": (
            cfg_overrides.get("fatigue_words") or gcfg.get("fatigueWords", [])
        ),
        "selected_arc": selected_arc,
    }


def _fmt(v) -> str:
    """Format a string or list into a single string."""
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        return "、".join(str(x) for x in v if str(x).strip())
    return ""


def build_genre_section(ctx: dict | None) -> str:
    """Render the '## 题材设定' markdown block for prompt injection.

    Returns "" when ctx is None. Shared by assembler.py and chapter_writer.py.
    """
    if not ctx:
        return ""
    lines = ["## 题材设定"]
    lines.append(f"题材：{ctx.get('name', '')}")
    if ctx.get("description"):
        lines.append(ctx["description"])
    if ctx.get("narrator_role"):
        lines.append(f"叙事者角色：{ctx['narrator_role']}")

    tone_parts = []
    if ctx.get("default_tone"):
        tone_parts.append(f"默认基调：{ctx['default_tone']}")
    if ctx.get("atmosphere"):
        tone_parts.append(f"氛围：{_fmt(ctx['atmosphere'])}")
    if ctx.get("pov"):
        tone_parts.append(f"叙事视角：{_fmt(ctx['pov'])}")
    if ctx.get("techniques"):
        tone_parts.append(f"描写技法：{_fmt(ctx['techniques'])}")
    if tone_parts:
        lines.append("；".join(tone_parts))

    if ctx.get("typical_arc"):
        lines.append(f"典型结构：{ctx['typical_arc']}")
    if ctx.get("taboos"):
        lines.append("题材禁忌：" + "；".join(str(x) for x in ctx["taboos"]))
    if ctx.get("prompt_injection"):
        lines.append(ctx["prompt_injection"])
    if ctx.get("chapter_types"):
        lines.append("章节类型：" + _fmt(ctx["chapter_types"]))
    if ctx.get("pacing_rules"):
        lines.append("节奏规则：" + _fmt(ctx["pacing_rules"]))
    if ctx.get("fulfillment_types"):
        lines.append("满足类型：" + _fmt(ctx["fulfillment_types"]))

    arc = ctx.get("selected_arc")
    if isinstance(arc, dict):
        arc_name = arc.get("name", "")
        arc_desc = arc.get("description", "")
        if arc_desc:
            lines.append(f"故事弧：{arc_name}（{arc_desc}）")
        elif arc_name:
            lines.append(f"故事弧：{arc_name}")
        beats = arc.get("beats", [])
        if beats:
            lines.append("弧节拍：" + " → ".join(str(b) for b in beats))

    return "\n".join(lines)
