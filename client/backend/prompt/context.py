"""Context injection helpers for prompt assembly — world setting + active hooks.

分段链路（assembler）已退役（ai-prompt-crafting）：story/character 注入由
write/chapter_writer 素材包统一承载；世界观注入块与活跃伏笔过滤/渲染
（排除本章引入 + 状态过滤 + ≤8 上限）为两条写作消费方共享，保留于此。
"""

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

    供整章写作（chapter_writer 素材包与粗组兜底）消费，
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


# ── 活跃伏笔（两条写作消费方共享的过滤与渲染）──────────────────────────


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


def filter_active_hooks(hooks_data: dict, current_chapter_ref: str) -> list[dict]:
    """活跃伏笔过滤：pending/mentioned 状态、排除本章引入，≤8 条上限。"""
    hooks = [
        h
        for h in (hooks_data or {}).get("active", [])
        # 前端 active 项无 status 字段 → 默认 pending；resolved/abandoned 不在 active，天然排除
        if h.get("status", "pending") in ("pending", "mentioned")
        and _canonical_chapter_ref(h.get("introduced_in", "")) != current_chapter_ref
    ]
    return hooks[:8]


def render_hooks_block(hooks: list[dict]) -> str:
    """活跃伏笔 →「## 当前悬而未决的伏笔」注入块（优先级/类型/状态后缀）。"""
    if not hooks:
        return ""
    lines = ["## 当前悬而未决的伏笔"]
    for h in hooks:
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


async def inject_active_hooks(root_path: str, current_chapter_ref: str) -> str:
    hooks_data = await get_storage().read_yaml(root_path, "settings/hooks.yaml")
    return render_hooks_block(filter_active_hooks(hooks_data, current_chapter_ref))
