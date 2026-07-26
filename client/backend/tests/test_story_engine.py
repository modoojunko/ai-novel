"""Tests for DeductionEngine -- init, round, rewind, checkpoint."""

import pytest

from story.engine import DeductionEngine
from story.models import CharacterState, RoundResult, StageState


@pytest.mark.asyncio
async def test_init_creates_engine():
    engine = DeductionEngine("proj-1", "/tmp/fake")
    assert engine.deduction_id is not None
    assert engine.round == 0
    assert len(engine.characters) == 0


@pytest.mark.asyncio
async def test_set_seed_adds_event():
    engine = DeductionEngine("proj-1", "/tmp/fake")
    engine.set_seed("B朝A射了一箭")
    assert engine.seed == "B朝A射了一箭"
    assert len(engine.stage.events) == 1
    assert engine.stage.events[0]["description"] == "B朝A射了一箭"


@pytest.mark.asyncio
async def test_add_character():
    engine = DeductionEngine("proj-1", "/tmp/fake")
    char = CharacterState(character_id="张三", position="峡谷中段", stamina=80)
    engine.add_character(char)
    assert "张三" in engine.characters
    assert engine.characters["张三"].stamina == 80


@pytest.mark.asyncio
async def test_rewind_to_round():
    engine = DeductionEngine("proj-1", "/tmp/fake")
    engine.set_seed("start")
    # Simulate adding history
    r0 = RoundResult(
        round_number=0, decisions=[], stage=StageState(), characters={}, events=[]
    )
    r1 = RoundResult(
        round_number=1, decisions=[], stage=StageState(), characters={}, events=[]
    )
    engine.history = [r0, r1]
    engine.round = 1

    engine.rewind_to(0)
    assert engine.round == 0


@pytest.mark.asyncio
async def test_to_dict_returns_serializable():
    engine = DeductionEngine("proj-1", "/tmp/fake")
    engine.set_seed("seed text")
    char = CharacterState(character_id="A", position="峡谷")
    engine.add_character(char)
    d = engine.to_dict()
    assert d["deduction_id"] == engine.deduction_id
    assert d["seed"] == "seed text"
    assert "A" in d["characters"]
    assert d["characters"]["A"]["position"] == "峡谷"


class TestSensoryInputs:
    def test_build_sensory_no_chars(self):
        engine = DeductionEngine("proj-1", "/tmp/fake")
        engine.stage.terrain = "丹霞峡谷"
        engine.stage.lighting = "充足"
        result = engine._build_sensory_inputs()
        assert result == {}

    def test_build_sensory_with_events(self):
        engine = DeductionEngine("proj-1", "/tmp/fake")
        engine.add_character(
            CharacterState(character_id="A", position="峡谷中段", stamina=30)
        )
        engine.stage.events.append(
            {
                "round": 0,
                "actor": "B",
                "action": "射箭",
                "description": "一支箭飞过来",
                "visibility": "公开",
            }
        )
        engine.round = 1
        result = engine._build_sensory_inputs()
        assert "A" in result
        assert "一支箭飞过来" in result["A"].hear or "体力" in result["A"].feel
