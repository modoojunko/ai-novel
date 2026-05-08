from datetime import datetime

from anthropic import Anthropic

from config import ANTHROPIC_API_KEY
from filesystem.storage import get_storage


async def archive_chapter(root_path: str, chapter_ref: str, full_text: str) -> dict:
    chapter = await get_storage().read_yaml(root_path, f"chapters/{chapter_ref}.yaml")

    vol = chapter.get("volume", 1)
    ch = chapter.get("chapter", 1)
    title = chapter.get("title", "untitled")
    slug = title.replace(" ", "-").lower()[:50]
    archive_path = f"archives/vol-{vol}-ch-{ch}-{slug}.md"
    await get_storage().write_md(root_path, archive_path, full_text)

    # Generate 200-char summary via AI
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": f"用200字以内总结本章核心事件，只陈述事实不评论：\n\n{full_text[:3000]}",
            }
        ],
    )
    summary = message.content[0].text[:200]

    chapter["archive_summary"] = summary
    chapter["archive_path"] = archive_path
    chapter["status"] = "archived"
    await get_storage().write_yaml(root_path, f"chapters/{chapter_ref}.yaml", chapter)

    await update_thread_state(root_path, chapter, summary)
    await update_character_states(root_path, chapter, full_text)

    return {
        "archive_path": archive_path,
        "summary": summary,
        "usage": {
            "input_tokens": message.usage.input_tokens,
            "output_tokens": message.usage.output_tokens,
        },
    }


async def update_thread_state(root_path: str, chapter: dict, summary: str):
    threads = await get_storage().read_yaml(root_path, "threads.yaml")
    thread_name = chapter.get("thread", "主线")

    if "threads" not in threads:
        threads["threads"] = {}
    if thread_name not in threads["threads"]:
        threads["threads"][thread_name] = {}

    t = threads["threads"][thread_name]
    t["pov"] = chapter.get("pov_character", t.get("pov", "未知"))
    t["last_chapter"] = f"vol-{chapter.get('volume')}-ch-{chapter.get('chapter')}"
    t["current_state"] = summary
    t["emotional_temperature"] = chapter.get("memo", {}).get("emotion_curve", "medium")

    hooks = await get_storage().read_yaml(root_path, "settings/hooks.yaml")
    for hook in hooks.get("hooks", []):
        if hook.get("introduced_in") == t["last_chapter"]:
            hook["status"] = "mentioned"
    await get_storage().write_yaml(root_path, "settings/hooks.yaml", hooks)

    await get_storage().write_yaml(root_path, "threads.yaml", threads)


async def update_character_states(root_path: str, chapter: dict, full_text: str):
    seg_chars = (
        chapter.get("outline", {}).get("segments", [{}])[0].get("characters", [])
    )
    for name in seg_chars:
        char = await get_storage().read_yaml(
            root_path, f"settings/character-setting/{name}.yaml"
        )
        if not char:
            continue
        if "state_history" not in char:
            char["state_history"] = []
        state_change = chapter.get("memo", {}).get("character_state_change", "")
        char["state_history"].append(
            {
                "chapter": f"vol-{chapter.get('volume')}-ch-{chapter.get('chapter')}",
                "change": state_change,
                "timestamp": datetime.now().isoformat(),
            }
        )
        await get_storage().write_yaml(
            root_path, f"settings/character-setting/{name}.yaml", char
        )
