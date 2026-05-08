from filesystem.storage import get_storage
from prompt.context import (
    inject_active_hooks,
    inject_character_snapshots,
    inject_story_context,
)


async def assemble_segment_prompt(
    root_path: str,
    chapter_ref: str,
    seg_idx: int,
    novel_title: str = "",
) -> str:
    chapter = await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml")
    style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml")
    anti_ai = await get_storage().read_yaml(root_path, "settings/anti-ai.yaml")
    threads = await get_storage().read_yaml(root_path, "threads.yaml")

    segments = chapter.get("outline", {}).get("segments", [])
    seg = segments[seg_idx] if seg_idx < len(segments) else {}

    vol = chapter.get("volume", "?")
    ch_num = chapter.get("chapter", "?")
    seg_num = seg.get("seg", seg_idx + 1)

    prompt = f"""## 角色定位
你是{style.get("role", "一位小说家")}。{style.get("core_principles", "")}

## 原则与禁忌
{style.get("possible_mistakes", "")}

禁止使用以下词汇：{", ".join(anti_ai.get("fatigue_words", []))}
禁止以下句式：{", ".join(anti_ai.get("forbidden_patterns", []))}

## 故事背景
本段是{novel_title}第{vol}卷第{ch_num}章第{seg_num}段。
{await inject_story_context(root_path, chapter, threads.get("threads", {}))}

{await inject_character_snapshots(root_path, seg.get("characters", []))}

{await inject_active_hooks(root_path, chapter_ref)}

## 写作指引
{seg.get("focus", "")}
情绪主调：{seg.get("emotion", "")}
关键桥段：{seg.get("key_beat", "")}
出场角色：{", ".join(seg.get("characters", []))}
地点：{seg.get("location", "")}
时间：{seg.get("time", "")}

注意：{chapter.get("memo", {}).get("to_avoid", "")}

## 写作要求
{style.get("depiction_techniques", "")}
输出长度：约{seg.get("target_words", 1500)}字。
不写总结、不写章节标题。
"""
    return prompt


async def assemble_all_segments(
    root_path: str, chapter_ref: str, novel_title: str = ""
) -> list[str]:
    chapter = await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml")
    segments = chapter.get("outline", {}).get("segments", [])
    prompts = []
    for i in range(len(segments)):
        prompt = await assemble_segment_prompt(root_path, chapter_ref, i, novel_title)
        prompt_path = f"prompts/{chapter_ref}-seg-{i + 1}-prompt.md"
        await get_storage().write_md(root_path, prompt_path, prompt)
        prompts.append(prompt_path)
    return prompts
