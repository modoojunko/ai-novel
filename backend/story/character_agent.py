"""Character agent — builds prompts, calls LLM, parses decisions."""

import json
import logging
import time

from ai_client import get_ai_client
from prompts import load as load_prompt
from story.models import SensoryInput, DecisionLog, Decision, CharacterState, StageState

logger = logging.getLogger(__name__)


def _build_decision_prompt(
    character: CharacterState,
    sensory: SensoryInput,
    stage: StageState,
) -> str:
    """Build the decision prompt for a single character."""
    cognition_lines = []
    cog = character.cognition_6 or {}
    for key, val in cog.items():
        if val:
            cognition_lines.append(f"- {key}：{val}")

    state_lines = [
        f"位置：{character.position}",
        f"体力：{character.stamina}%",
        f"情绪：{character.emotion}",
    ]
    if character.urgency:
        state_lines.insert(0, f"紧急：{character.urgency}")

    return load_prompt("story_character").format(
        character_cognition="\n".join(cognition_lines) or "（无特殊设定）",
        character_state="\n".join(state_lines),
        see=sensory.see or "（无特殊视觉信息）",
        hear=sensory.hear or "（无特殊听觉信息）",
        sense=sensory.smell or sensory.feel or "（无特殊感觉）",
        knowledge="; ".join(character.knowledge) if character.knowledge else "（无特殊信息）",
        relationships=json.dumps(character.relationships, ensure_ascii=False) if character.relationships else "（无特殊关系认知）",
    )


# ── Fallback when LLM fails ────────────────────────────────────────

_FALLBACK = DecisionLog(
    see="（无法获取）",
    hear="（无法获取）",
    sense="（无法获取）",
    understanding="（LLM返回异常）",
    values_checked="（无法判断）",
    ability_assessment="（无法评估）",
    emotion="（未知）",
    urgency="（未知）",
    decision_process="（LLM返回异常，使用默认行为）",
    action_type="等待",
    action_target="",
    action_description="（AI 决策异常，原地待命中）",
    inner_monologue="…",
    action_impact="（未知）",
)


def _extract_json(text: str) -> dict | None:
    """Extract JSON from LLM response. Tries multiple formats. Returns None if all fail."""
    cleaned = text.strip()

    # Try: direct JSON
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try: markdown code fence
    if "```" in cleaned:
        parts = cleaned.split("```")
        for i, part in enumerate(parts):
            if i % 2 != 1:
                continue
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            try:
                return json.loads(part)
            except json.JSONDecodeError:
                continue

    # Try: find first { ... } or [ ... ] block
    for left, right in [("{", "}"), ("[", "]")]:
        start = cleaned.find(left)
        if start >= 0:
            end = cleaned.rfind(right)
            if end > start:
                try:
                    return json.loads(cleaned[start:end + 1])
                except json.JSONDecodeError:
                    continue

    return None


def _parse_decision(text: str, character_id: str, sensory: SensoryInput, round_num: int) -> Decision:
    """Parse LLM response into Decision. Never crashes — uses fallback on failure."""
    data = _extract_json(text)
    if data is None:
        logger.warning("Non-JSON response from %s round %d: %.150s", character_id, round_num, text)
        return Decision(
            character_id=character_id, sensory_input=sensory,
            log=_FALLBACK, round=round_num, timestamp=int(time.time()),
        )

    return Decision(
        character_id=character_id, sensory_input=sensory,
        log=DecisionLog(
            see=data.get("see", ""), hear=data.get("hear", ""),
            sense=data.get("sense", ""),
            understanding=data.get("understanding", ""),
            values_checked=data.get("values_checked", ""),
            ability_assessment=data.get("ability_assessment", ""),
            emotion=data.get("emotion", ""),
            urgency=data.get("urgency", ""),
            decision_process=data.get("decision_process", ""),
            action_type=data.get("action_type", ""),
            action_target=data.get("action_target", ""),
            action_description=data.get("action_description", ""),
            inner_monologue=data.get("inner_monologue", ""),
            action_impact=data.get("action_impact", ""),
        ),
        round=round_num, timestamp=int(time.time()),
    )


async def run_character_decision(
    character: CharacterState,
    sensory: SensoryInput,
    stage: StageState,
    round_num: int,
) -> Decision:
    """Run one character's decision. Retries once on failure. Always returns a Decision."""
    prompt = _build_decision_prompt(character, sensory, stage)
    client = get_ai_client()

    for attempt in range(2):
        try:
            text = await client.chat(
                model="haiku",
                system="你是一位小说角色扮演者。只输出 JSON，不要任何其他文字。",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1024,
            )
            if _extract_json(text) is not None:
                return _parse_decision(text, character.character_id, sensory, round_num)
            logger.warning("Bad JSON from %s (attempt %d), retrying…", character.character_id, attempt)
        except Exception as e:
            logger.warning("LLM call failed for %s (attempt %d): %s", character.character_id, attempt, e)

    return Decision(
        character_id=character_id, sensory_input=sensory,
        log=_FALLBACK, round=round_num, timestamp=int(time.time()),
    )


async def run_all_decisions(
    characters: dict[str, CharacterState],
    sensory_inputs: dict[str, SensoryInput],
    stage: StageState,
    round_num: int,
) -> list[Decision]:
    """Run decisions for all characters in parallel. Never crashes."""
    import asyncio

    tasks = [
        run_character_decision(char, sensory_inputs.get(cid, SensoryInput()), stage, round_num)
        for cid, char in characters.items()
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, Decision)]
