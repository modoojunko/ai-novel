"""Character agent — builds prompts, calls LLM, parses decisions."""

import json
import time

from ai_client import get_ai_client
from prompts import load as load_prompt
from story.models import SensoryInput, DecisionLog, Decision, CharacterState, StageState


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


def _parse_decision(text: str, character_id: str, sensory: SensoryInput, round_num: int) -> Decision:
    """Parse LLM response into a Decision object."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0]
    try:
        data = json.loads(cleaned.strip())
    except json.JSONDecodeError:
        data = {}

    log = DecisionLog(
        see=data.get("see", ""),
        hear=data.get("hear", ""),
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
    )

    return Decision(
        character_id=character_id,
        sensory_input=sensory,
        log=log,
        round=round_num,
        timestamp=int(time.time()),
    )


async def run_character_decision(
    character: CharacterState,
    sensory: SensoryInput,
    stage: StageState,
    round_num: int,
) -> Decision:
    """Run one character's decision process: build prompt → call LLM → parse."""
    prompt = _build_decision_prompt(character, sensory, stage)

    client = get_ai_client()
    try:
        text = await client.chat(
            model="haiku",
            system="你是一位小说角色扮演者。只输出 JSON，不要任何其他文字。",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
        )
    except Exception:
        text = '{"action_type":"等待","action_description":"（LLM调用失败，无法决策）","inner_monologue":"…"}'

    return _parse_decision(text, character.character_id, sensory, round_num)


async def run_all_decisions(
    characters: dict[str, CharacterState],
    sensory_inputs: dict[str, SensoryInput],
    stage: StageState,
    round_num: int,
) -> list[Decision]:
    """Run decisions for all characters in parallel."""
    import asyncio

    tasks = []
    for cid, character in characters.items():
        sensory = sensory_inputs.get(cid, SensoryInput())
        tasks.append(run_character_decision(character, sensory, stage, round_num))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    decisions = []
    for r in results:
        if isinstance(r, Decision):
            decisions.append(r)
    return decisions
