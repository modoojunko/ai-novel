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


def _repair_json(text: str) -> str | None:
    """Try to repair common JSON-in-JSON issues (single quotes, trailing commas, etc)."""
    # Replace single quotes around keys/values with double quotes
    # This handles: {'key': 'value'} → {"key": "value"}
    import re
    result = text

    # Replace single quotes at word boundaries (keys and string values)
    result = re.sub(r"(?<=[{, ])'([^']+?)'(?=\s*[:,\]}])", r'"\1"', result)

    # Remove trailing commas before ] or }
    result = re.sub(r",\s*([}\]])", r"\1", result)

    # Replace Python/JS literals
    result = result.replace("None", "null").replace("undefined", "null")
    result = result.replace("True", "true").replace("False", "false")

    try:
        json.loads(result)
        return result
    except json.JSONDecodeError:
        return None


def _extract_fallback_text(text: str) -> dict | None:
    """Last resort: extract whatever useful info we can from plain text."""
    lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
    # Pick the most action-like line
    for line in lines[:5]:
        # Skip obvious meta-text
        if any(kw in line for kw in ["分析", "评估", "考虑", "因为", "所以", "决定"]):
            continue
        if len(line) > 8:
            return {
                "see": "", "hear": "", "sense": "", "understanding": "",
                "values_checked": "", "ability_assessment": "",
                "emotion": "", "urgency": "",
                "decision_process": "",
                "action_type": "动作", "action_target": "",
                "action_description": line[:200],
                "inner_monologue": "", "action_impact": "",
            }
    return None


def _extract_json(text: str) -> dict | None:
    """Extract JSON from LLM response. Tries multiple formats + repair. Never crashes."""
    cleaned = text.strip()

    # 1. Direct JSON
    for src in [cleaned]:
        try:
            return json.loads(src)
        except json.JSONDecodeError:
            pass
        # Repair and retry
        repaired = _repair_json(src)
        if repaired:
            try:
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass

    # 2. Markdown code fence (```json ... ```)
    if "```" in cleaned:
        parts = cleaned.split("```")
        for i, part in enumerate(parts):
            if i % 2 != 1:
                continue
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            for src in [part]:
                try:
                    return json.loads(src)
                except json.JSONDecodeError:
                    pass
                repaired = _repair_json(src)
                if repaired:
                    try:
                        return json.loads(repaired)
                    except json.JSONDecodeError:
                        pass

    # 3. Find { ... } or [ ... ] block
    for left, right in [("{", "}"), ("[", "]")]:
        start = cleaned.find(left)
        if start >= 0:
            end = cleaned.rfind(right)
            if end > start:
                for src in [cleaned[start:end + 1]]:
                    try:
                        return json.loads(src)
                    except json.JSONDecodeError:
                        pass
                    repaired = _repair_json(src)
                    if repaired:
                        try:
                            return json.loads(repaired)
                        except json.JSONDecodeError:
                            pass

    # 4. Last resort: extract action from plain text
    return _extract_fallback_text(cleaned)


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
