import json
import re
from collections.abc import Callable

from anthropic import AsyncAnthropic
from anthropic.types import Usage

from config import ANTHROPIC_API_KEY
from filesystem.storage import get_storage


def _validate_ref(ref: str) -> str:
    if ".." in ref or "/" in ref:
        raise ValueError("Invalid chapter reference")
    return ref


async def stream_segment(
    root_path: str,
    chapter_ref: str,
    seg_idx: int,
    model: str = "claude-haiku-4-5-20251001",
    on_complete: Callable[[Usage], object] | None = None,
):
    _validate_ref(chapter_ref)
    prompt = await get_storage().read_md(
        root_path, f"prompts/{chapter_ref}-seg-{seg_idx}-prompt.md"
    )
    style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml")
    anti_ai = await get_storage().read_yaml(root_path, "settings/anti-ai.yaml")

    system_msg = (
        f"你是{style.get('role', '一位小说家')}。{style.get('core_principles', '')}"
    )

    client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    full_text = ""
    async with client.messages.stream(
        model=model,
        max_tokens=4096,
        system=system_msg,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for event in stream:
            if event.type == "content_block_delta" and event.delta.type == "text_delta":
                chunk = event.delta.text
                full_text += chunk
                violations = _scan_chunk(full_text, anti_ai)
                yield f"data: {json.dumps({'type': 'violation' if violations else 'chunk', 'text': chunk, 'violations': violations}, ensure_ascii=False)}\n\n"

            elif event.type == "message_stop":
                tokens = 0
                if hasattr(event, "usage") and event.usage:
                    tokens = event.usage.output_tokens
                    if on_complete:
                        await on_complete(event.usage)
                yield f"data: {json.dumps({'type': 'done', 'full_text': full_text, 'total_tokens': tokens}, ensure_ascii=False)}\n\n"


def _scan_chunk(text: str, anti_ai: dict) -> list[str]:
    violations = []
    for word in anti_ai.get("fatigue_words", []):
        if word in text:
            violations.append(f"疲劳词: {word}")
    for pattern in anti_ai.get("forbidden_patterns", []):
        try:
            if re.search(pattern, text):
                violations.append(f"禁用句式: {pattern}")
        except re.error:
            pass
    return violations
