import json
import re

from ai_client import get_ai_client
from filesystem.storage import get_storage


def _validate_ref(ref: str) -> str:
    if ".." in ref or "/" in ref:
        raise ValueError("Invalid chapter reference")
    return ref


async def stream_segment(
    root_path: str,
    chapter_ref: str,
    seg_idx: int,
    model: str | None = None,
):
    _validate_ref(chapter_ref)
    prompt = await get_storage().read_md(
        root_path, f"prompts/{chapter_ref}-seg-{seg_idx}-prompt.md"
    )
    style = await get_storage().read_yaml(root_path, "settings/writing-style.yaml")
    anti_ai = await get_storage().read_yaml(root_path, "settings/anti-ai.yaml")

    if model is None:
        model = style.get("writing_model", "haiku")

    system_msg = style.get("role", "一位小说家")

    client = get_ai_client()
    full_text = ""
    async for event in client.chat_stream(
        model=model,
        system=system_msg,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4096,
    ):
        if event.text:
            full_text += event.text
            violations = _scan_chunk(full_text, anti_ai)
            yield f"data: {json.dumps({'type': 'violation' if violations else 'chunk', 'text': event.text, 'violations': violations}, ensure_ascii=False)}\n\n"
        elif event.is_done:
            yield f"data: {json.dumps({'type': 'done', 'full_text': full_text, 'total_tokens': event.tokens}, ensure_ascii=False)}\n\n"


def _scan_chunk(text: str, anti_ai: dict) -> list[str]:
    violations = []

    # Flatten fatigue_words_zh
    fw = anti_ai.get("fatigue_words_zh", {})
    all_words = []
    for category in fw.values():
        if isinstance(category, list):
            all_words.extend(category)
    for word in all_words:
        if word in text:
            violations.append(f"疲劳词: {word}")

    # Scan structural_tic_patterns
    for tic in anti_ai.get("structural_tic_patterns", []):
        if not isinstance(tic, dict):
            continue
        try:
            if re.search(tic.get("pattern", ""), text):
                violations.append(f"禁用句式[{tic.get('name', '')}]")
        except re.error:
            pass
    return violations
