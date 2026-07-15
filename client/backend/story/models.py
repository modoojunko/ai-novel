"""Story deduction domain models."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class StageState:
    """Current state of the stage/environment."""

    terrain: str = ""
    time: str = ""
    weather: str = ""
    lighting: str = "充足"
    noise: str = "安静"
    visibility_modifiers: str = ""
    terrain_effects: str = ""
    events: list[dict] = field(default_factory=list)
    round: int = 0


@dataclass
class SensoryInput:
    """What a character perceives in a round."""

    see: str = ""
    hear: str = ""
    smell: str = ""
    feel: str = ""
    environment: str = ""


@dataclass
class DecisionLog:
    """Full decision chain of a character in one round."""

    see: str = ""
    hear: str = ""
    sense: str = ""
    understanding: str = ""
    values_checked: str = ""
    ability_assessment: str = ""
    emotion: str = ""
    urgency: str = ""
    decision_process: str = ""
    action_type: str = ""
    action_target: str = ""
    action_description: str = ""
    inner_monologue: str = ""
    action_impact: str = ""


@dataclass
class Decision:
    """One character's decision in one round."""

    character_id: str
    sensory_input: SensoryInput
    log: DecisionLog
    round: int = 0
    timestamp: int = 0


@dataclass
class CharacterState:
    """State of a character in the deduction."""

    character_id: str
    position: str = ""
    stamina: int = 100
    emotion: str = "平静"
    urgency: str = ""
    knowledge: list[str] = field(default_factory=list)
    relationships: dict[str, Any] = field(default_factory=dict)
    cognition_6: dict[str, str] = field(default_factory=dict)
    perception_config: dict[str, str] = field(default_factory=dict)


@dataclass
class RoundResult:
    """Result of one deduction round."""

    round_number: int
    decisions: list[Decision]
    stage: StageState
    characters: dict[str, CharacterState]
    events: list[dict]
    checkpoint_id: str = ""
