from filesystem.storage import get_storage
from genres.service import build_genre_section, resolve_genre_context
from prompt.context import (
    inject_active_hooks,
    inject_character_snapshots,
    inject_story_context,
)
from settings.render import (
    build_tone_section,
    depiction_techniques_str,
    flatten_principles,
    fmt_mistakes,
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


async def assemble_segment_prompt(
    root_path: str,
    chapter_ref: str,
    seg_idx: int,
    novel_title: str = "",
) -> str:
    from prompts import load as load_prompt

    _validate_ref(chapter_ref)
    from workflow.engine import load_chapter

    chapter = await load_chapter(root_path, chapter_ref)
    style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml")
    anti_ai = await get_storage().read_yaml(root_path, "settings/anti-ai.yaml")
    threads = await get_storage().read_yaml(root_path, "threads.yaml")

    # 题材定义注入：genre_id 为空或定义缺失时优雅降级（空串 + 无疲劳词）
    gctx = await resolve_genre_context(root_path)
    genre_section = build_genre_section(gctx)
    genre_fatigue = gctx.get("fatigue_words", []) if gctx else []

    segments = chapter.get("segments", [])
    seg = segments[seg_idx] if seg_idx < len(segments) else {}

    # 前端大纲编辑器只保存 summary/target_words；写作指引字段做语义回退，
    # 避免真实数据在组装时被丢弃（goal←summary、字数←target_words、情绪/角色←章级）。
    what_to_write = seg.get("what_to_write") or seg.get("summary", "")
    goal = seg.get("goal") or what_to_write
    emotional_tone = (
        seg.get("emotional_tone")
        or chapter.get("emotional_design", {}).get("primary_mood", "")
    )
    characters = seg.get("characters") or chapter.get("outline", {}).get(
        "characters", []
    )
    function = seg.get("function", "")
    word_target = seg.get("word_target") or seg.get("target_words", 500)

    vol = chapter.get("volume", "?")
    ch_num = chapter.get("chapter", "?")
    seg_num = seg.get("seg_number", seg_idx + 1)

    template = load_prompt("chapter_segment")
    prompt = template.format(
        role=style.get("role", "一位小说家"),
        core_principles="；".join(flatten_principles(style.get("core_principles"))),
        common_mistakes=fmt_mistakes(style.get("possible_mistakes")),
        fatigue_words=", ".join(_flatten_fatigue_words(anti_ai) + genre_fatigue),
        tic_patterns=", ".join(_extract_tic_patterns(anti_ai)),
        novel_title=novel_title,
        vol=vol,
        ch_num=ch_num,
        seg_num=seg_num,
        story_context=await inject_story_context(
            root_path, chapter, threads.get("threads", {})
        ),
        character_snapshots=await inject_character_snapshots(
            root_path, seg.get("characters", [])
        ),
        active_hooks=await inject_active_hooks(root_path, chapter_ref),
        what_to_write=what_to_write,
        goal=goal,
        emotional_tone=emotional_tone,
        characters=", ".join(characters),
        function=function,
        prohibitions=_format_prohibitions(
            chapter.get("memo", {}).get("prohibitions", [])
        ),
        depiction_techniques=depiction_techniques_str(style),
        word_target=word_target,
        genre_section=genre_section,
        tone_section=build_tone_section(style),
    )
    return prompt


async def assemble_all_segments(
    root_path: str, chapter_ref: str, novel_title: str = ""
) -> list[str]:
    _validate_ref(chapter_ref)
    from prompt.store import save_prompt
    from workflow.engine import load_chapter

    chapter = await load_chapter(root_path, chapter_ref)
    segments = chapter.get("segments", [])
    prompts = []
    for i in range(len(segments)):
        prompt = await assemble_segment_prompt(root_path, chapter_ref, i, novel_title)
        # chapter_prompts 表（PR④）：name=seg-{i+1}-prompt；对外路径形态保持
        await save_prompt(root_path, chapter_ref, f"seg-{i + 1}-prompt", prompt)
        prompts.append(f"prompts/{chapter_ref}-seg-{i + 1}-prompt.md")
    return prompts
