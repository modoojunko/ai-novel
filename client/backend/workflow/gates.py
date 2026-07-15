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
    """Check if chapter outline is ready for prompt generation.

    Verifies chapter.yaml against reference/chapter.yaml.template schema.
    """
    missing = []
    memo = chapter_data.get("memo", {})

    # current_task — chapter's must-do action
    if not memo.get("current_task"):
        missing.append("memo.current_task is empty")

    # reader_expectation — nested object; state + detail must be non-empty
    rexp = memo.get("reader_expectation", {})
    if not rexp.get("state"):
        missing.append("memo.reader_expectation.state is empty")
    if not rexp.get("strategy"):
        missing.append("memo.reader_expectation.strategy is empty")

    # required_changes — at least 1 change per chapter
    changes = memo.get("required_changes", [])
    if not changes:
        missing.append("memo.required_changes is empty")

    # prohibitions — optional, skip

    # emotional_design — must have primary_mood
    ed = chapter_data.get("emotional_design", {})
    if not ed.get("primary_mood"):
        missing.append("emotional_design.primary_mood is empty")

    # segments — must exist in outline
    segments = chapter_data.get("segments", [])
    if not segments:
        missing.append("segments is empty")

    return len(missing) == 0, missing


async def gate_prompts_exist(root_path: str, chapter_ref: str) -> bool:
    files = await get_storage().list_dir(root_path, "prompts")
    return any(f.startswith(chapter_ref) for f in files)


def gate_quality_passed(chapter_data: dict) -> bool:
    return chapter_data.get("quality_check", {}).get("passed", False)
