"""Context injection for prompt assembly — sliding window + cross-thread."""

import re

from filesystem.storage import get_storage

# 世界观字段 → 中文标签（与 world-setting.yaml.template 结构一致）
WORLD_FIELD_LABELS = {
    "geography": {
        "scenes": "主要场景",
        "climate": "气候",
        "limits": "地理限制",
    },
    "politics": {
        "rule": "统治形式",
        "factions": "主要势力",
        "social": "社会分层",
        "cost": "不服从的代价",
    },
    "rules": {
        "world": "世界规则",
        "society": "社会规则",
        "personal": "个人规则",
    },
}


def _trim(text, limit: int) -> str:
    """字段值截断（防 prompt 膨胀），缺失/非 str 安全返回空串。"""
    if text is None:
        return ""
    text = str(text).strip()
    return text if len(text) <= limit else text[:limit] + "…"


def _fmt_list(value) -> str:
    """字符串或字符串列表 → "、" 连接字符串。"""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "、".join(str(v) for v in value if str(v).strip())
    return ""


def inject_world_setting(world: dict) -> str:
    """世界观 → 细粒度注入块（geography/politics/rules 全字段，缺失安全）。

    供提示词面板（assembler）与整章写入（chapter_writer）共用，
    替代旧的"每个大类只取第一个非空子字段"截断逻辑。
    """
    if not isinstance(world, dict):
        return ""
    lines = []
    for group, fields in WORLD_FIELD_LABELS.items():
        data = world.get(group)
        if not isinstance(data, dict):
            continue
        for key, label in fields.items():
            val = _fmt_list(data.get(key))
            if val:
                lines.append(f"- {label}：{_trim(val, 200)}")
    if not lines:
        return ""
    return "世界观：\n" + "\n".join(lines)


async def inject_story_context(
    root_path: str, chapter: dict, thread_state: dict
) -> str:
    """Inject story context from synopsis, world, volume, chapter outline and memo."""
    parts = []
    outline = chapter.get("outline", {})
    memo = chapter.get("memo", {})

    # 故事前提（synopsis）——提示词面板路径此前不注入，补上
    story = await get_storage().read_yaml(root_path, "story.yaml") or {}
    if story.get("synopsis"):
        parts.append(f"故事前提：{_trim(story['synopsis'], 300)}")

    # 世界观细粒度注入
    world = (
        await get_storage().read_yaml(root_path, "settings/world-setting.yaml") or {}
    )
    world_block = inject_world_setting(world)
    if world_block:
        parts.append(world_block)

    # 卷概要（volume 字段为数字或 vol-N 字符串，兼容两种）
    vol_match = re.match(r"(?:vol-)?(\d+)", str(chapter.get("volume", "")))
    if vol_match:
        vol_data = (
            await get_storage().read_yaml(
                root_path, f"volumes/vol-{vol_match.group(1)}.yaml"
            )
            or {}
        )
        if vol_data.get("summary"):
            parts.append(f"本卷概要：{_trim(vol_data['summary'], 200)}")

    # Chapter summary
    if outline.get("summary"):
        parts.append(f"本章概要：{outline['summary']}")

    # 场景/时间/视角（此前不注入，场景锚点防"角色瞬移"）
    if outline.get("location"):
        parts.append(f"场景：{outline['location']}")
    if outline.get("time"):
        parts.append(f"时间：{outline['time']}")
    if outline.get("narrative_pov"):
        parts.append(f"叙事视角：{outline['narrative_pov']}")

    # Current task
    if memo.get("current_task"):
        parts.append(f"当前任务：{memo['current_task']}")

    # 读者在等什么（情绪缺口）
    reader_expectation = memo.get("reader_expectation")
    if isinstance(reader_expectation, dict) and reader_expectation.get("detail"):
        parts.append(f"读者在等什么：{reader_expectation['detail']}")

    # Key points
    key_points = outline.get("key_points", [])
    if key_points:
        parts.append(f"关键情节点：{'; '.join(str(k) for k in key_points)}")

    # 本章必须完成的改变（硬约束）
    required_changes = memo.get("required_changes", [])
    if isinstance(required_changes, list) and required_changes:
        parts.append(
            f"本章必须完成的改变：{'; '.join(str(c) for c in required_changes)}"
        )

    # 本章应兑现的伏笔（与活跃伏笔并列）
    payoff_plan = memo.get("payoff_plan")
    if isinstance(payoff_plan, dict):
        must_resolve = payoff_plan.get("must_resolve", [])
        if isinstance(must_resolve, list) and must_resolve:
            parts.append(
                f"本章应兑现的伏笔：{'; '.join(str(h) for h in must_resolve)}"
            )

    return "\n\n".join(parts) if parts else ""


async def inject_character_snapshots(root_path: str, character_names: list[str]) -> str:
    parts = []
    for name in character_names:
        ch_data = await get_storage().read_yaml(
            root_path, f"settings/character-setting/{name}.yaml"
        )
        if not ch_data:
            parts.append(f"### {name}\n（新角色，无前史）")
            continue
        lines = [f"### {name}"]
        # 键名对齐：前端/AI 生成存 role，兼容旧模板 story_role
        identity = ch_data.get("role") or ch_data.get("story_role", "")
        if identity:
            lines.append(f"身份：{identity}")
        # 当前状态：state_history 最后一条 → personality 兜底（归档回写未上线前保底）
        state = ""
        history = ch_data.get("state_history", [])
        if isinstance(history, list) and history:
            last = history[-1]
            if isinstance(last, dict):
                state = last.get("status", "") or last.get("state", "")
        if not state:
            state = ch_data.get("personality", "")
        if state:
            lines.append(f"当前状态：{_trim(state, 120)}")
        for label, key in [
            ("能力", "abilities"),
            ("技能", "skills"),
            ("关系", "relationships"),
            ("背景", "background"),
            ("外貌", "appearance"),
            ("价值观", "values"),
            ("所在", "environment"),
        ]:
            val = _fmt_list(ch_data.get(key))
            if val:
                lines.append(f"{label}：{_trim(val, 120)}")
        parts.append("\n".join(lines))
    return "\n\n".join(parts)


def _canonical_chapter_ref(ref: str) -> str:
    """把伏笔引入章节归一为规范 vol-N-ch-M 格式（兼容模板短格式 '1-1'）。"""
    ref = (ref or "").strip()
    if re.match(r"^vol-\d+-ch-\d+$", ref):
        return ref
    m = re.match(r"^(\d+)-(\d+)$", ref)
    if m:
        return f"vol-{m.group(1)}-ch-{m.group(2)}"
    return ref


_PRIORITY_LABELS = {1: "核心", 2: "重要", 3: "可选"}


async def inject_active_hooks(root_path: str, current_chapter_ref: str) -> str:
    hooks_data = await get_storage().read_yaml(root_path, "settings/hooks.yaml")
    hooks = [
        h
        for h in hooks_data.get("active", [])
        # 前端 active 项无 status 字段 → 默认 pending；resolved/abandoned 不在 active，天然排除
        if h.get("status", "pending") in ("pending", "mentioned")
        and _canonical_chapter_ref(h.get("introduced_in", "")) != current_chapter_ref
    ]
    if not hooks:
        return ""
    lines = ["## 当前悬而未决的伏笔"]
    for h in hooks[:8]:
        desc = h.get("description", "").strip()
        status = h.get("status", "待定")
        # 优先级 + 类型注入（键名兼容：前端存 type，语义键 hook_type）
        meta = []
        priority = h.get("priority")
        if priority is not None:
            try:
                meta.append(f"优先级：{_PRIORITY_LABELS.get(int(priority), priority)}")
            except (TypeError, ValueError):
                pass
        hook_type = h.get("hook_type") or h.get("type")
        if hook_type:
            meta.append(f"类型：{hook_type}")
        suffix = f"（{'，'.join(meta)}）" if meta else ""
        # 前端项无 id，用描述作为标识；旧格式有 id 保留 [id] 前缀
        if h.get("id"):
            lines.append(f"- [{h['id']}] {desc}{suffix}（状态：{status}）")
        else:
            lines.append(f"- {desc}{suffix}（状态：{status}）")
    return "\n".join(lines)
