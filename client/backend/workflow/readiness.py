"""Settings readiness — content-based completion checks (PRD 3.4).

Product decision (2026-08-02):
- Creation does NOT judge settings completion (empty settings are normal).
- Judgement happens when the author clicks "完成设定" (ConfirmToggle):
  the item's content is checked; empty -> 400 + hint, non-empty -> confirmed.
- Template default values count as content (non-empty passes).

7 items are judged (ai-model is NOT part of readiness).
"""

from filesystem.storage import get_storage

# world details 子字段非空阈值（推荐值：8 个子字段中 ≥4）
WORLD_DETAILS_THRESHOLD = 4


def _has_nonempty(v) -> bool:
    """Recursively check whether a yaml value contains any non-empty scalar."""
    if isinstance(v, dict):
        return any(_has_nonempty(x) for x in v.values())
    if isinstance(v, list):
        return any(_has_nonempty(x) for x in v)
    return bool(v is not None and str(v).strip())


async def _check_synopsis(root_path: str) -> bool:
    story = await get_storage().read_yaml(root_path, "story.yaml") or {}
    return bool(str(story.get("synopsis", "")).strip())


async def _check_genre(root_path: str) -> bool:
    genre = await get_storage().read_yaml(root_path, "settings/genre.yaml") or {}
    return bool(str(genre.get("genre_id", "")).strip())


async def _check_world(root_path: str) -> bool:
    world = await get_storage().read_yaml(root_path, "settings/world-setting.yaml") or {}
    # 前端保存顶层 geography/politics/rules 三组对象（与写正文引擎一致），
    # 统计子字段非空数达到阈值即可确认。旧 details 结构是过时模板。
    filled = 0
    for section in ("geography", "politics", "rules"):
        sub = world.get(section)
        if not isinstance(sub, dict):
            continue
        filled += sum(1 for v in sub.values() if str(v).strip())
    return filled >= WORLD_DETAILS_THRESHOLD


async def _check_style(root_path: str) -> bool:
    style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml") or {}
    return bool(str(style.get("role", "")).strip())


async def _check_anti_ai(root_path: str) -> bool:
    anti_ai = await get_storage().read_yaml(root_path, "settings/anti-ai.yaml") or {}
    return _has_nonempty(anti_ai)


async def _check_hooks(root_path: str) -> bool:
    hooks = await get_storage().read_yaml(root_path, "settings/hooks.yaml") or {}
    # 前端保存 active/resolved/abandoned 三表（写作引擎只消费 active 悬而未决伏笔）。
    hook_list = hooks.get("active")
    if not isinstance(hook_list, list):
        return False
    return any(
        bool(str(h.get("description", "") or h.get("seed_text", "") or h.get("id", "")).strip())
        for h in hook_list
        if isinstance(h, dict)
    )


async def _check_characters(root_path: str) -> bool:
    files = await get_storage().list_dir(root_path, "settings/character-setting")
    return any(f.endswith(".yaml") for f in files)


# 判定表（单一来源）：key -> (label, jump, checker)
READINESS_CHECKERS: list[tuple[str, str, str, object]] = [
    ("synopsis", "故事简介", "synopsis", _check_synopsis),
    ("genre", "题材类型", "genre", _check_genre),
    ("world", "世界设定", "world", _check_world),
    ("style", "写作风格", "style", _check_style),
    ("anti-ai", "AI痕迹控制", "anti-ai", _check_anti_ai),
    ("hooks", "伏笔管理", "hooks", _check_hooks),
    ("characters", "角色管理", "characters", _check_characters),
]

READINESS_KEYS = {key for key, _label, _jump, _check in READINESS_CHECKERS}


async def compute_readiness(root_path: str) -> dict:
    """Compute the 7-item content readiness.

    Returns {"complete": bool, "missing": [{key, label, jump}], "warning": str}.
    """
    missing = []
    for key, label, jump, check in READINESS_CHECKERS:
        if not await check(root_path):  # type: ignore[operator]
            missing.append({"key": key, "label": label, "jump": jump})
    complete = not missing
    warning = (
        ""
        if complete
        else f"还差 {len(missing)} 项设定，可以先补完再开始，也可以直接开始"
    )
    return {"complete": complete, "missing": missing, "warning": warning}
