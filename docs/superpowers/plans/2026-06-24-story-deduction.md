# 剧情推演 — 实现计划

> **For agentic workers:** Use superpowers:subagent-driven-development to implement.

**Goal:** Multi-agent turn-based story deduction engine. Characters with independent cognition (6-layer model), sensory isolation per round, emergent plot generation.

**Architecture:** Backend engine manages rounds + checkpoints + character isolation. Each character decision is an independent LLM call (haiku). Frontend displays stage map + character states + event wall with rewind/adjust support.

**Tech Stack:** Python/FastAPI + AIClient (backend), React 19 + daisyUI (frontend), pytest + Playwright (tests)

---

## File Structure

### Backend — Create

| File | Purpose |
|------|---------|
| `backend/story/__init__.py` | Package init |
| `backend/story/engine.py` | Deduction engine (round loop, checkpoint, stage updates) |
| `backend/story/character_agent.py` | Character agent (prompt builder, cognition 6-layer, decision parser) |
| `backend/story/models.py` | Domain objects (StageState, CharacterState, Decision, Round) |
| `backend/story/prompts.py` | Prompt templates for character decisions |
| `backend/story/router.py` | API routes |
| `backend/tests/test_story_engine.py` | Engine unit tests |
| `backend/tests/test_story_agent.py` | Agent prompt + parser tests |

### Frontend — Create

| File | Purpose |
|------|---------|
| `frontend/src/components/novel/story/DeductionPanel.tsx` | Main deduction panel |
| `frontend/src/components/novel/story/StageMap.tsx` | Stage map with character positions |
| `frontend/src/components/novel/story/CharacterCard.tsx` | Character state + decision log |
| `frontend/src/components/novel/story/EventWall.tsx` | Event timeline |
| `frontend/src/components/novel/story/SeedInputModal.tsx` | Trigger seed input |
| `frontend/src/components/novel/story/AdjustPanel.tsx` | Author adjust panel |
| `frontend/src/lib/story.ts` | Story API wrapper |

### Frontend — Modify

| File | Change |
|------|--------|
| `frontend/src/pages/NovelPage.tsx` | Add 🔮 tab to the chapter view |

---

### Phase 1: Backend Core

#### Task 1: Domain models

**Files:**
- Create: `backend/story/__init__.py`
- Create: `backend/story/models.py`

```python
"""Story deduction domain models."""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class StageState:
    terrain: str = ""
    time: str = ""
    weather: str = ""
    events: list[dict] = field(default_factory=list)  # public event pool
    round: int = 0


@dataclass
class SensoryInput:
    see: str = ""
    hear: str = ""
    smell: str = ""
    feel: str = ""
    environment: str = ""


@dataclass
class DecisionLog:
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
    character_id: str
    sensory_input: SensoryInput
    log: DecisionLog
    round: int = 0
    timestamp: int = 0


@dataclass
class CharacterState:
    character_id: str
    position: str = ""
    stamina: int = 100
    emotion: str = "平静"
    urgency: str = ""
    knowledge: list[str] = field(default_factory=list)
    relationships: dict[str, Any] = field(default_factory=dict)
    cognition_6: dict[str, str] = field(default_factory=dict)


@dataclass
class RoundResult:
    round_number: int
    decisions: list[Decision]
    stage: StageState
    characters: dict[str, CharacterState]
    events: list[dict]
    checkpoint_id: str = ""
```

- [ ] **Commit:** `git add backend/story/ && git commit -m "feat: add story deduction domain models"`

#### Task 2: Prompt templates

**Files:**
- Create: `backend/story/prompts.py`

```python
"""Prompt templates for story deduction character agents."""

CHARACTER_DECISION_PROMPT = """你正在扮演一个小说角色。基于以下信息，决定ta在这一轮会做什么。

## 角色设定
{character_cognition}

## 当前处境
{character_state}

## 你感知到的信息
### 看到
{see}
### 听到
{hear}
### 其他感觉
{sense}

## 你当前知道的信息
{knowledge}

## 你的主观关系认知
{relationships}

---

请严格按照以下 JSON 格式输出你的决策过程（不要输出其他文字）：

{{
  "see": "你看到了什么",
  "hear": "你听到了什么",
  "sense": "你嗅到/感觉到/直觉到什么",
  "understanding": "基于你的世界观和自我定位，你如何理解现在的局面",
  "values_checked": "你确认了什么事能做、什么事不能做",
  "ability_assessment": "你评估了自己有什么手段可用",
  "emotion": "你现在的情绪状态",
  "urgency": "对你来说当前最紧急的事",
  "decision_process": "综合以上判断，你决定怎么做",
  "action_type": "移动|攻击|喊话|隐藏|观察|使用道具|等待",
  "action_target": "",
  "action_description": "具体动作描述",
  "inner_monologue": "角色的内心独白（第一人称）",
  "action_impact": "你觉得这一行动可能带来什么后果"
}}
```

STAGE_SYNTHESIS_PROMPT = """作为剧情推演助手，将所有角色的决策合成为连贯的剧情片段。

## 当前舞台
{stage}

## 各角色决策
{decisions}

请输出本轮发生的剧情事件列表（JSON数组）：
[
  {{
    "actor": "角色名",
    "action": "动作描述",
    "target": "目标（可选）",
    "result": "结果",
    "visibility": "公开|仅角色可见"
  }}
]
"""
```

- [ ] **Commit:** `git add backend/story/prompts.py && git commit -m "feat: add story deduction prompt templates"`

#### Task 3: Character agent (decision LLM caller)

**Files:**
- Create: `backend/story/character_agent.py`

The character agent handles:
1. Building the prompt for a character (injecting cognition 6-layer, state, sensory input)
2. Calling `get_ai_client().chat()` with haiku model
3. Parsing the response into a DecisionLog
4. Running N agents in parallel (using asyncio.gather)

- [ ] **Commit:** `git add backend/story/character_agent.py && git commit -m "feat: add character agent with cognition 6-layer decision"`

#### Task 4: Deduction engine (core loop)

**Files:**
- Create: `backend/story/engine.py`

The engine handles:
1. `init_deduction()` — load project data, check completeness
2. `seed_trigger()` — set the initial trigger event
3. `run_round()` — execute one round (Step 1 → Step 2 → Step 3)
4. `rewind_to_round()` — load a checkpoint
5. Checkpoint management (save/load StageState snapshots)

- [ ] **Commit:** `git add backend/story/engine.py && git commit -m "feat: add story deduction engine with checkpoint support"`

#### Task 5: Backend API routes

**Files:**
- Create: `backend/story/router.py`
- Modify: `backend/main.py` (register router)

Endpoints:
- `POST /api/story/init` — init deduction from project data
- `POST /api/story/{id}/seed` — set trigger seed
- `POST /api/story/{id}/round` — run one round
- `POST /api/story/{id}/rewind/{round}` — rewind to checkpoint
- `POST /api/story/{id}/adjust` — author adjusts state
- `POST /api/story/{id}/stop` — stop, output summary
- `GET /api/story/{id}` — get deduction record

- [ ] **Commit:** `git add backend/story/router.py backend/main.py && git commit -m "feat: add story deduction API routes"`

---

### Phase 2: Frontend

#### Task 6: Story API wrapper

**Files:**
- Create: `frontend/src/lib/story.ts`

API wrapper with functions: `initDeduction`, `seedTrigger`, `runRound`, `rewind`, `adjust`, `stop`, `getDeduction`

- [ ] **Commit:** `git add frontend/src/lib/story.ts && git commit -m "feat: add story deduction API wrapper"`

#### Task 7: Deduction panel components

**Files:**
- Create: `frontend/src/components/novel/story/StageMap.tsx` — character positions on terrain
- Create: `frontend/src/components/novel/story/CharacterCard.tsx` — state + expandable decision log
- Create: `frontend/src/components/novel/story/EventWall.tsx` — timeline of events
- Create: `frontend/src/components/novel/story/SeedInputModal.tsx` — trigger seed input
- Create: `frontend/src/components/novel/story/AdjustPanel.tsx` — state adjust form
- Create: `frontend/src/components/novel/story/DeductionPanel.tsx` — main panel orchestrating all sub-components

- [ ] **Commit:** `git add frontend/src/components/novel/story/ && git commit -m "feat: add story deduction UI components"`

#### Task 8: Wire into NovelPage

**Files:**
- Modify: `frontend/src/pages/NovelPage.tsx`

Add a third tab to the view tabs: `[正文] [提示词] [🔮 推演]`
When the deduction tab is active, render DeductionPanel.

- [ ] **Commit:** `git add frontend/src/pages/NovelPage.tsx && git commit -m "feat: wire story deduction tab into novel page"`

---

### Phase 3: Tests

#### Task 9: Backend tests

**Files:**
- Create: `backend/tests/test_story_engine.py`
  - `test_init_deduction` — verify engine loads project data correctly
  - `test_round_flow` — mock LLM, run one round, verify output structure
  - `test_multi_round` — run 3 rounds, verify character states evolve
  - `test_rewind` — run 3 rounds, rewind to round 1, verify state restored
  - `test_context_isolation` — verify round 2 LLM prompt doesn't contain round 1 data

- **Commit:** `git add backend/tests/test_story_engine.py && git commit -m "test: add story deduction engine tests"`

#### Task 10: Frontend E2E tests

**Files:**
- Create: `frontend/e2e/deduction.spec.ts`

  - Deduction tab is visible in chapter editor
  - Initialization shows stage + characters
  - Seed input modal works
  - Running a round displays results
  - Rewind to previous round
  - Adjust character state

- **Commit:** `git add frontend/e2e/deduction.spec.ts && git commit -m "test: add story deduction E2E tests"`

---

### Phase 4: Integration

#### Task 11: Docker rebuild + full test suite

```bash
cd d:/code/ai-novel && docker compose up -d --build
cd backend && python -m pytest tests/ -v
cd frontend && npx playwright test
```

#### Task 12: Final commit

```bash
git add -A && git commit -m "feat: complete story deduction system"
```
