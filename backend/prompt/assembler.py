from filesystem.storage import get_storage
from prompt.context import (
    inject_active_hooks,
    inject_character_snapshots,
    inject_story_context,
)


def _validate_ref(ref: str) -> str:
    if ".." in ref or "/" in ref:
        raise ValueError("Invalid chapter reference")
    return ref


def _flatten_fatigue_words(anti_ai: dict) -> list[str]:
    """Flatten fatigue_words_zh (nested 7 categories) into a single list."""
    fw = anti_ai.get("fatigue_words_zh", {})
    words = []
    for category in fw.values():
        if isinstance(category, list):
            words.extend(category)
    return words


def _extract_tic_patterns(anti_ai: dict) -> list[str]:
    """Extract pattern strings from structural_tic_patterns."""
    patterns = anti_ai.get("structural_tic_patterns", [])
    return [p["pattern"] for p in patterns if isinstance(p, dict) and "pattern" in p]


def _format_prohibitions(prohibitions: list) -> str:
    """Format memo.prohibitions list into a string."""
    if not prohibitions:
        return "（无特别限制）"
    return "；".join(str(p) for p in prohibitions)


def depiction_techniques_str(style: dict) -> str:
    """Format depiction_techniques into a prompt-friendly string."""
    techniques = style.get("depiction_techniques", [])
    if not techniques:
        return style.get("depiction_techniques", "")
    lines = []
    for t in techniques:
        if isinstance(t, dict):
            lines.append(f"- {t.get('name', '')}: {t.get('description', '')}")
    return "\n".join(lines) if lines else ""


async def assemble_segment_prompt(
    root_path: str,
    chapter_ref: str,
    seg_idx: int,
    novel_title: str = "",
) -> str:
    _validate_ref(chapter_ref)
    chapter = await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml")
    style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml")
    anti_ai = await get_storage().read_yaml(root_path, "settings/anti-ai.yaml")
    threads = await get_storage().read_yaml(root_path, "threads.yaml")

    segments = chapter.get("segments", [])
    seg = segments[seg_idx] if seg_idx < len(segments) else {}

    vol = chapter.get("volume", "?")
    ch_num = chapter.get("chapter", "?")
    seg_num = seg.get("seg_number", seg_idx + 1)

    prompt = f"""## 角色定位
你是{style.get("role", "一位小说家")}。{style.get("core_principles", "")}

## 原则与禁忌
{style.get("possible_mistakes", "")}

禁止使用以下词汇：{", ".join(_flatten_fatigue_words(anti_ai))}
禁止以下句式：{", ".join(_extract_tic_patterns(anti_ai))}

## 故事背景
本段是{novel_title}第{vol}卷第{ch_num}章第{seg_num}段。
{await inject_story_context(root_path, chapter, threads.get("threads", {}))}

{await inject_character_snapshots(root_path, seg.get("characters", []))}

{await inject_active_hooks(root_path, chapter_ref)}

## 写作指引
{seg.get("what_to_write", "")}
本段目标：{seg.get("goal", "")}
情绪基调：{seg.get("emotional_tone", "")}
出场角色：{", ".join(seg.get("characters", []))}
段落功能：{seg.get("function", "")}

注意：{_format_prohibitions(chapter.get("memo", {}).get("prohibitions", []))}

## 写作要求
{depiction_techniques_str(style)}
输出长度：约{seg.get("word_target", 500)}字。
不写总结、不写章节标题。
"""
    return prompt


async def assemble_all_segments(
    root_path: str, chapter_ref: str, novel_title: str = ""
) -> list[str]:
    _validate_ref(chapter_ref)
    chapter = await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml")
    segments = chapter.get("segments", [])
    prompts = []
    for i in range(len(segments)):
        prompt = await assemble_segment_prompt(root_path, chapter_ref, i, novel_title)
        prompt_path = f"prompts/{chapter_ref}-seg-{i + 1}-prompt.md"
        await get_storage().write_md(root_path, prompt_path, prompt)
        prompts.append(prompt_path)
    return prompts
