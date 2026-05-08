from filesystem.storage import get_storage


async def gate_settings_complete(root_path: str) -> tuple[bool, list[str]]:
    """Check if settings are complete enough to start outlining."""
    missing = []
    world = await get_storage().read_yaml(root_path, "settings/world-setting.yaml")
    style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml")
    hooks = await get_storage().read_yaml(root_path, "settings/hooks.yaml")

    filled_fields = sum(1 for v in world.values() if v)
    if filled_fields < 5:
        missing.append("world-setting: need at least 5 fields filled")
    if not style.get("role"):
        missing.append("writing-style: role not set")
    hook_list = hooks.get("hooks", [])
    if len(hook_list) < 3:
        missing.append("hooks: need at least 3 hooks")

    return len(missing) == 0, missing


def gate_chapter_ready(chapter_data: dict) -> tuple[bool, list[str]]:
    """Check if chapter outline is ready for prompt generation."""
    missing = []
    memo = chapter_data.get("memo", {})
    memo_fields = [
        "why_this_scene",
        "reader_promise",
        "reader_question",
        "emotion_curve",
        "character_state_change",
        "thread_position",
        "to_avoid",
    ]
    for f in memo_fields:
        if not memo.get(f):
            missing.append(f"memo.{f} is empty")

    segments = chapter_data.get("outline", {}).get("segments", [])
    if not segments:
        missing.append("no segments defined")

    return len(missing) == 0, missing


async def gate_prompts_exist(root_path: str, chapter_ref: str) -> bool:
    files = await get_storage().list_dir(root_path, "prompts")
    return any(f.startswith(chapter_ref) for f in files)


def gate_quality_passed(chapter_data: dict) -> bool:
    return chapter_data.get("quality_check", {}).get("passed", False)
