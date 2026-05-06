"""Context injection for prompt assembly — sliding window + cross-thread."""

from filesystem.reader import read_yaml


def inject_story_context(root_path: str, chapter: dict, thread_state: dict) -> str:
    parts = []
    thread_name = chapter.get("thread", "")

    if thread_state and thread_name in thread_state:
        t = thread_state[thread_name]
        parts.append(f"当前线索状态：{t.get('current_state', '')}")
        parts.append(f"情绪温度：{t.get('emotional_temperature', 'medium')}")

    concurrent = chapter.get("concurrent_with", [])
    for ref in concurrent:
        if thread_state:
            for tname, tdata in thread_state.items():
                if tdata.get("last_chapter") == ref:
                    parts.append(
                        f"同时发生（{tname}）：{tdata.get('current_state', '')}"
                    )
                    break

    cross = chapter.get("crossover_ref", "")
    if cross:
        cross_ch = read_yaml(root_path, f"chapters/{cross}.yaml")
        if cross_ch:
            parts.append(
                f"上次交汇（{cross}）：{cross_ch.get('outline', {}).get('summary', '')[:200]}"
            )

    return "\n\n".join(parts) if parts else ""


def inject_character_snapshots(root_path: str, character_names: list[str]) -> str:
    parts = []
    for name in character_names:
        ch_data = read_yaml(root_path, f"settings/character-setting/{name}.yaml")
        if not ch_data:
            parts.append(f"### {name}\n（新角色，无前史）")
            continue
        history = ch_data.get("state_history", [])
        parts.append(
            f"### {name}\n"
            f"身份：{ch_data.get('role', '未知')}\n"
            f"当前状态：{history[-1].get('state', '初始') if history else '初始'}\n"
            f"动机：{ch_data.get('current_motivation', '不明')}\n"
            f"所在：{ch_data.get('current_location', '不明')}"
        )
    return "\n\n".join(parts)


def inject_active_hooks(root_path: str, current_chapter_ref: str) -> str:
    hooks_data = read_yaml(root_path, "settings/hooks.yaml")
    hooks = [
        h
        for h in hooks_data.get("hooks", [])
        if h.get("status") in ("mentioned", "reinforced")
        and h.get("introduced_in") != current_chapter_ref
    ]
    if not hooks:
        return ""
    lines = ["## 当前悬而未决的伏笔"]
    for h in hooks[:8]:
        lines.append(f"- [{h['id']}] {h['description']}（状态：{h['status']}）")
    return "\n".join(lines)
