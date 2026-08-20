"""章族存取 DB 心脏 — 表⇆JSON 组装/拆装（API JSON 结构不变，前端零改动）。

- load_chapter(root_path, ref)：DB 行 → 章全量 dict（outline/memo/emotional_design/
  scene_cards/knowledge_states/segments/prose），形态与 YAML 时代逐键一致。
- save_chapter(root_path, ref, data)：dict 拆装落库（标量+子表整体替换+正文 upsert），
  同事务派生 word_count/has_prose/status/outline_status；prose 或 outline.summary
  变化时写 versions YAML 快照（PR③ 切 DB），上限 MAX_VERSIONS_PER_CHAPTER。
- collect_prose_by_root(root_path)：全项目正文拼接（AI 回填语料）。

长度纪律：SQLite 不强制 VARCHAR 长度，写入侧 _fit() 截断到列宽
（用户输入由 router 层 Pydantic max_length 严校验拒收；AI 生成物截断安全）。
"""

import contextlib
import logging
import re
import time

from sqlalchemy import select

from novels.service import count_chars
from workflow.engine import MAX_VERSIONS_PER_CHAPTER, strip_suffix

logger = logging.getLogger("uvicorn.error")

# 章纲标量列映射：(JSON 键, 列名, 列宽)
_OUTLINE_SCALARS = [
    ("summary", "summary", 300),
    ("location", "location", 200),
    ("time", "story_time", 150),
    ("narrative_pov", "narrative_pov", 50),
]
_EMOTIONAL_SCALARS = [
    ("primary_mood", "primary_mood", 50),
    ("mood_progression", "mood_progression", 300),
    ("intensity_peak", "intensity_peak", 300),
    ("intensity_level", "intensity_level", None),
    ("emotional_hook", "emotional_hook", 150),
]
_EXPECTATION_SCALARS = [
    ("state", "expectation_state", 150),
    ("strategy", "expectation_strategy", 50),
    ("detail", "expectation_detail", 300),
]

_KEY_POINT_TAG = re.compile(r"^\[([^\]]+)\](.*)$", re.DOTALL)
_COLON_SPLIT = re.compile(r"^([^：:]{1,50})[：:]\s*(.+)$", re.DOTALL)


def _fit(value, width: int | None):
    """写入侧截断：None 直通；超宽截断（生成物截断安全，用户输入走 schema 拒收）。"""
    if value is None:
        return None
    s = str(value)
    if width is not None and len(s) > width:
        return s[:width]
    return s


def _parse_key_point(item: str) -> tuple[str, str]:
    """'[推进剧情·对话] 内容' → ('推进剧情·对话', '内容')；无标签 → ('', 原文)。"""
    m = _KEY_POINT_TAG.match(item or "")
    if m:
        return m.group(1).strip()[:50], m.group(2)
    return "", item or ""


def _format_key_point(tag: str, content: str) -> str:
    return f"[{tag}]{content}" if tag else content


def _split_labeled(item: str) -> tuple[str, str]:
    """'场景：功能' → ('场景', '功能')；无标签 → ('', 原文)。"""
    m = _COLON_SPLIT.match((item or "").strip())
    if m:
        return m.group(1).strip(), m.group(2)
    return "", item or ""


def _derive_outline_status(status: str, prose: str) -> str:
    if status == "confirmed":
        return "confirmed"
    if (prose or "").strip():
        return "in_progress"
    return "unfilled"


def _int_or_none(value):
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


# ── 组装：DB 行 → 章 JSON（形态对齐 YAML 时代）──────────────────────────────


def assemble_chapter(row) -> dict:
    """Chapter 行（selectin 已带子表/正文/卷）→ 全量章 dict。"""
    data: dict = {
        "volume": row.volume.volume_no,
        "chapter": row.chapter_no,
        "title": row.title,
        "status": row.status,
        "prose": row.content.prose if row.content is not None else "",
    }
    if row.word_target is not None:
        data["word_target"] = row.word_target

    outline: dict = {
        "key_points": [_format_key_point(k.func_tag, k.content) for k in row.key_points],
        "characters": [c.character_name for c in row.characters],
    }
    for json_key, col, _w in _OUTLINE_SCALARS:
        outline[json_key] = getattr(row, col) or ""
    if row.perspective_guidance:
        outline["perspective_guidance"] = row.perspective_guidance
    data["outline"] = outline

    payoff: dict[str, list[str]] = {
        "must_resolve": [],
        "must_hold": [],
        "partial_advance": [],
    }
    for p in row.payoff_items:
        payoff.setdefault(p.kind, []).append(p.content)
    memo: dict = {
        "current_task": row.current_task or "",
        "reader_expectation": {
            json_key: getattr(row, col) or ""
            for json_key, col, _w in _EXPECTATION_SCALARS
        },
        "payoff_plan": payoff,
        "downtime_functions": [
            f"{d.scene}：{d.func}" if d.scene else d.func
            for d in row.downtime_functions
        ],
        "key_choices": [k.content for k in row.key_choices],
        "required_changes": [
            f"{c.change_type}：{c.content}" if c.change_type else c.content
            for c in row.required_changes
        ],
        "prohibitions": [p.content for p in row.prohibitions],
    }
    data["memo"] = memo

    emotional = {
        json_key: getattr(row, col)
        for json_key, col, _w in _EMOTIONAL_SCALARS
        if getattr(row, col) is not None
    }
    if emotional:
        data["emotional_design"] = emotional

    if row.scene_cards:
        data["scene_cards"] = [
            {
                "scene_name": s.scene_name,
                "goal": s.goal,
                "obstacle": s.obstacle,
                "hook": s.hook,
            }
            for s in row.scene_cards
        ]
    if row.knowledge_states:
        data["knowledge_states"] = [
            {
                "character_name": k.character_name,
                "knows": k.knows,
                "unknowns": k.unknowns,
                "gap_relation": k.gap_relation,
                "gap_change": k.gap_change,
            }
            for k in row.knowledge_states
        ]

    data["segments"] = [_assemble_segment(s) for s in row.segments]
    return data


def _assemble_segment(s) -> dict:
    seg: dict = {"summary": s.summary or "", "target_words": s.target_words or 0}
    for key in ("what_to_write", "goal", "emotional_tone", "function"):
        value = getattr(s, key)
        if value:
            seg[key] = value
    if s.characters:
        seg["characters"] = [n.strip() for n in s.characters.split(",") if n.strip()]
    if s.word_target is not None:
        seg["word_target"] = s.word_target
    if s.seg_number is not None:
        seg["seg_number"] = s.seg_number
    return seg


# ── 拆装：章 JSON → DB 行（子表整体替换）───────────────────────────────────


def _disassemble_scalars(row, data: dict) -> None:
    outline = data.get("outline") or {}
    memo = data.get("memo") or {}
    emotional = data.get("emotional_design") or {}
    expectation = memo.get("reader_expectation") or {}

    for json_key, col, width in _OUTLINE_SCALARS:
        setattr(row, col, _fit(outline.get(json_key), width))
    row.perspective_guidance = _fit(outline.get("perspective_guidance"), 300)
    row.current_task = _fit(memo.get("current_task"), 300)
    for json_key, col, width in _EXPECTATION_SCALARS:
        setattr(row, col, _fit(expectation.get(json_key), width))
    for json_key, col, width in _EMOTIONAL_SCALARS:
        setattr(row, col, _fit(emotional.get(json_key), width))
    row.word_target = _int_or_none(data.get("word_target"))


_CHILD_ATTRS = (
    "key_points", "characters", "payoff_items", "downtime_functions",
    "key_choices", "required_changes", "prohibitions",
    "scene_cards", "knowledge_states", "segments",
)


def _replace_children(row, data: dict) -> None:
    from models.chapter import (
        ChapterCharacter,
        ChapterContent,
        ChapterDowntimeFunction,
        ChapterKeyChoice,
        ChapterKeyPoint,
        ChapterKnowledgeState,
        ChapterPayoffItem,
        ChapterProhibition,
        ChapterRequiredChange,
        ChapterSceneCard,
        ChapterSegment,
    )

    outline = data.get("outline") or {}
    memo = data.get("memo") or {}

    row.key_points = [
        ChapterKeyPoint(sort_order=i, func_tag=tag, content=_fit(content, 300) or "")
        for i, item in enumerate(outline.get("key_points") or [])
        for tag, content in [_parse_key_point(str(item))]
    ]
    row.characters = [
        ChapterCharacter(sort_order=i, character_name=str(name).strip()[:50])
        for i, name in enumerate(outline.get("characters") or [])
        if str(name).strip()
    ]

    payoff_rows: list[tuple[int, str, str]] = []
    payoff_order = 0
    for kind in ("must_resolve", "must_hold", "partial_advance"):
        for item in memo.get("payoff_plan", {}).get(kind) or []:
            # 三类共用一个递增序号：逐类从 0 编号会撞 UNIQUE(chapter_id, sort_order)
            payoff_rows.append((payoff_order, kind, str(item)))
            payoff_order += 1
    row.payoff_items = [
        ChapterPayoffItem(sort_order=i, kind=kind, content=_fit(content, 300) or "")
        for i, kind, content in payoff_rows
    ]
    row.downtime_functions = [
        ChapterDowntimeFunction(
            sort_order=i, scene=_fit(scene, 150) or "", func=_fit(func, 300) or ""
        )
        for i, item in enumerate(memo.get("downtime_functions") or [])
        for scene, func in [_split_labeled(str(item))]
    ]
    row.key_choices = [
        ChapterKeyChoice(sort_order=i, content=_fit(str(item), 300) or "")
        for i, item in enumerate(memo.get("key_choices") or [])
    ]
    row.required_changes = [
        ChapterRequiredChange(
            sort_order=i,
            change_type=_fit(kind, 50) or "",
            content=_fit(content, 300) or "",
        )
        for i, item in enumerate(memo.get("required_changes") or [])
        for kind, content in [_split_labeled(str(item))]
    ]
    row.prohibitions = [
        ChapterProhibition(sort_order=i, content=_fit(str(item), 300) or "")
        for i, item in enumerate(memo.get("prohibitions") or [])
    ]

    row.scene_cards = [
        ChapterSceneCard(
            sort_order=i,
            scene_name=_fit(sc.get("scene_name", ""), 200) or "",
            goal=_fit(sc.get("goal", ""), 300) or "",
            obstacle=_fit(sc.get("obstacle", ""), 300) or "",
            hook=_fit(sc.get("hook", ""), 300) or "",
        )
        for i, sc in enumerate(data.get("scene_cards") or [])
        if isinstance(sc, dict)
    ]
    row.knowledge_states = [
        ChapterKnowledgeState(
            sort_order=i,
            character_name=_fit(ks.get("character_name", ""), 50) or "",
            knows=_fit(ks.get("knows", ""), 300) or "",
            unknowns=_fit(ks.get("unknowns", ""), 300) or "",
            gap_relation=_fit(ks.get("gap_relation", ""), 300) or "",
            gap_change=_fit(ks.get("gap_change", ""), 300) or "",
        )
        for i, ks in enumerate(data.get("knowledge_states") or [])
        if isinstance(ks, dict)
    ]

    row.segments = [
        ChapterSegment(
            sort_order=i,
            summary=_fit(seg.get("summary", ""), 300) or "",
            target_words=_int_or_none(seg.get("target_words")),
            what_to_write=_fit(seg.get("what_to_write"), 300),
            goal=_fit(seg.get("goal"), 300),
            emotional_tone=_fit(seg.get("emotional_tone"), 50),
            characters=_fit(
                ",".join(str(n).strip() for n in seg.get("characters") or []), 200
            ),
            function=_fit(seg.get("function"), 150),
            word_target=_int_or_none(seg.get("word_target")),
            seg_number=_int_or_none(seg.get("seg_number")),
        )
        for i, seg in enumerate(data.get("segments") or [])
        if isinstance(seg, dict)
    ]

    prose = data.get("prose") or ""
    if row.content is not None:
        row.content.prose = prose
    else:
        row.content = ChapterContent(prose=prose)


# ── 对外入口（签名与 YAML 时代的 engine.load/save 一致）────────────────────


async def _get_chapter_by_root(session, root_path: str, chapter_ref: str):
    """root_path + ref 定位章行（AI 链路手里只有 root_path）。"""
    from models.chapter import Chapter
    from models.project import Novel

    stmt = (
        select(Chapter)
        .join(Novel, Novel.id == Chapter.project_id)
        .where(Novel.root_path == root_path, Chapter.ref == strip_suffix(chapter_ref))
    )
    return await session.scalar(stmt)


async def load_chapter(root_path: str, chapter_ref: str) -> dict:
    """章全量 dict；行缺失返回 {}（调用方 404）。"""
    from db import async_session

    async with async_session() as session:
        row = await _get_chapter_by_root(session, root_path, chapter_ref)
        if row is None:
            return {}
        return assemble_chapter(row)


async def save_chapter(root_path: str, chapter_ref: str, data: dict) -> None:
    """统一写入口：拆装落库 + 元数据派生 + versions 快照（PR③ 前仍文件）。

    子表 clear 后先 flush 落删除再重建（flush 内插入先于删除会撞唯一键）。
    """
    from db import async_session

    ref = strip_suffix(chapter_ref)
    async with async_session() as session:
        row = await _get_chapter_by_root(session, root_path, ref)
        if row is None:
            raise LookupError(f"chapter row not found for {ref}")

        old_prose = row.content.prose if row.content is not None else ""
        old_summary = row.summary or ""
        old_status = row.status

        if data.get("title"):
            row.title = str(data["title"])[:200]
        status = data.get("status") or row.status
        row.status = status
        _disassemble_scalars(row, data)
        for attr in _CHILD_ATTRS:
            getattr(row, attr).clear()
        await session.flush()
        _replace_children(row, data)

        prose = data.get("prose") or ""
        row.word_count = count_chars(prose)
        row.has_prose = bool(prose.strip())
        row.outline_status = _derive_outline_status(status, prose)
        await session.commit()

    # 版本快照：prose / outline.summary 实质变化才写（正文已落库，快照失败不回滚）
    new_summary = (data.get("outline") or {}).get("summary") or ""
    if old_prose != prose or old_summary != new_summary:
        with contextlib.suppress(Exception):
            await _write_version_snapshot(
                root_path, ref, old_status, prose, data.get("outline") or {}, status
            )


async def _write_version_snapshot(
    root_path: str, ref: str, old_status: str, prose: str, outline: dict, status: str
) -> None:
    """versions/{ref}/v{毫秒}.yaml — PR③ 切 chapter_versions 表前的过渡实现。"""
    from filesystem.storage import get_storage

    timestamp = int(time.time() * 1000)
    version_data = {
        "version": f"v{timestamp}",
        "chapter_ref": ref,
        "created_at": timestamp,
        "comment": "自动保存",
        "snapshot": {
            "prose": prose,
            "outline": outline,
            "status": status or old_status,
        },
    }
    storage = get_storage()
    await storage.write_yaml(root_path, f"versions/{ref}/v{timestamp}.yaml", version_data)
    # 快照上限：文件名 v{13 位毫秒} 同位数，字典序即时间序。
    version_files = [
        f for f in await storage.list_dir(root_path, f"versions/{ref}")
        if f.endswith(".yaml")
    ]
    if len(version_files) > MAX_VERSIONS_PER_CHAPTER:
        version_files.sort()
        excess = len(version_files) - MAX_VERSIONS_PER_CHAPTER
        for old_file in version_files[:excess]:
            await storage.delete_file(root_path, f"versions/{ref}/{old_file}")


async def collect_prose_by_root(root_path: str) -> str:
    """全项目正文拼接（AI 回填语料；替代扫章 YAML）。"""
    from db import async_session
    from models.chapter import Chapter, ChapterContent
    from models.project import Novel

    stmt = (
        select(ChapterContent.prose)
        .join(Chapter, Chapter.id == ChapterContent.chapter_id)
        .join(Novel, Novel.id == Chapter.project_id)
        .where(Novel.root_path == root_path)
        .order_by(Chapter.ref)
    )
    async with async_session() as session:
        return "\n\n".join(p for p in await session.scalars(stmt) if p)
