"""Context injection for prompt assembly — sliding window + cross-thread."""

from filesystem.storage import get_storage


async def inject_story_context(
    root_path: str, chapter: dict, thread_state: dict
) -> str:
    """Inject story context from chapter outline and memo."""
    parts = []
    outline = chapter.get("outline", {})
    memo = chapter.get("memo", {})

    # Chapter summary
    if outline.get("summary"):
        parts.append(f"本章概要：{outline['summary']}")

    # Current task
    if memo.get("current_task"):
        parts.append(f"当前任务：{memo['current_task']}")

    # Key points
    key_points = outline.get("key_points", [])
    if key_points:
        parts.append(f"关键情节点：{'; '.join(key_points)}")

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
        history = ch_data.get("state_history", [])
        parts.append(
            f"### {name}\n"
            f"身份：{ch_data.get('story_role', '未知')}\n"
            f"当前状态：{history[-1].get('status', '初始') if history else '初始'}\n"
            f"价值观：{ch_data.get('values', '不明')}\n"
            f"所在：{ch_data.get('environment', '不明')}"
        )
    return "\n\n".join(parts)


async def inject_active_hooks(root_path: str, current_chapter_ref: str) -> str:
    hooks_data = await get_storage().read_yaml(root_path, "settings/hooks.yaml")
    hooks = [
        h
        for h in hooks_data.get("hooks", [])
        if h.get("status") in ("pending", "mentioned")
        and h.get("introduced_in") != current_chapter_ref
    ]
    if not hooks:
        return ""
    lines = ["## 当前悬而未决的伏笔"]
    for h in hooks[:8]:
        lines.append(f"- [{h['id']}] {h['description']}（状态：{h['status']}）")
    return "\n".join(lines)
