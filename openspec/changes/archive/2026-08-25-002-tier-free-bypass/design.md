# Tier 门控旁路 + 归档免费化 — Design

## 核心文件

### 新增 `client/backend/workflow/tier.py`

```python
from auth_local.service import check_permission
from workflow.gates import GateResult


def tier_bypass() -> bool:
    """当前是否无付费权益（免费 或 过期付费）→ 旁路。"""
    perm = check_permission()
    if perm.get("tier") == "none":
        return True
    return not perm.get("allowed", True)  # 过期付费 allowed=False


async def tier_or_gate(db, project, gate_fn, *args) -> GateResult:
    """free 恒过（不 invoke gate_fn）；PRO 走现状 gate_fn(*args)。"""
    if tier_bypass():
        return GateResult(valid=True, warnings=[], hard_block=False)
    return await gate_fn(*args)


def tier_phase_transition(project, new_phase: str):
    """free 下 update_phase 跳过 can_transition 校验（force）；PRO 走现状。"""
    if tier_bypass():
        project.current_phase = new_phase
        return
    from workflow.engine import update_phase
    update_phase(project, new_phase)
```

要点：
- `tier_bypass` 用 `check_permission()` 而非裸 `get_local_config()`，天然覆盖过期付费（`allowed=False`）。`check_permission` 无 DB 依赖、纯读 config.json，可在 async 上下文外直接调用。
- `tier_or_gate` 保持 `async`（全部 gate_fn 均为 async）。free 分支不 invoke gate_fn。
- `tier_phase_transition` free 分支直接赋值，跳过 `can_transition`（幂等推进 O3）。

### 修改 `workflow/gates.py` — B4 修复

`gate_archived`：`.yaml` → `.md`（归档实际落盘 `.md`）。DB COUNT 版本待 005（建表）后再切，本 change 先修后缀 bug。

```python
async def gate_archived(root_path: str) -> GateResult:
    files = await get_storage().list_dir(root_path, "archives")
    archive_files = [f for f in files if f.endswith(".md")]  # 原 .yaml → .md
    ...
```

### 修改 `workflow/router.py` — 接入 tier 旁路

- `transition_workflow`：三处 gate 走 `tier_or_gate`；`update_phase` 走 `tier_phase_transition`。
- `phase_status_endpoint`：free 时返回 `{phases: 全 complete, warnings: [], tier_bypass: true}`。

```python
from workflow.tier import tier_bypass, tier_or_gate, tier_phase_transition

@router.post("/transition")
async def transition_workflow(...):
    ...
    if target == "outline":
        result = await tier_or_gate(db, project, gate_settings_complete, project.root_path)
        tier_phase_transition(project, "outline")
        ...
    if target == "prompt":
        ...
        for ...: result = await tier_or_gate(db, project, gate_chapter_ready, chapter)
        ...
        tier_phase_transition(project, "prompt")
    if target == "write":
        ...
        for ...: result = await tier_or_gate(db, project, gate_prompts_exist, project.root_path, ref)
        ...
        tier_phase_transition(project, "write")

@router.get("/phase-status")
async def phase_status_endpoint(...):
    ...
    if tier_bypass():
        return {"phases": {p: "complete" for p in PHASE_ORDER}, "warnings": [], "tier_bypass": True}
    status = await get_phase_status(...)
    return status
```

注：`PHASE_ORDER` 从 `workflow.gates` import。`update_phase` import 可改为 `tier_phase_transition`，或保留两者（transition 内统一用 tier_phase_transition）。

### 修改 `chapters/router.py` — create_volume / confirm_chapter 接入

```python
# create_volume
result = await tier_or_gate(db, project, gate_settings_complete, project.root_path)
# confirm_chapter
result = await tier_or_gate(db, project, gate_chapter_ready, chapter)
```

### 修改 `archive/router.py` — 归档免费化

- 三处移除 `_: bool = Depends(require_ai_access)`（import 删除 `require_ai_access`）。
- `update_phase(project, "archive")` → `tier_phase_transition(project, "archive")`（N9）。

### 修改 `archive/service.py` — AI 摘要降级

```python
# Generate summary via AI, degrade to first 200 chars when unavailable
try:
    client = await get_ai_client()
    summary_text = await client.chat(...)
    summary = summary_text[:200]
except (ValueError, Exception):  # ValueError: 未配 Key；其他: chat 异常
    summary = full_text[:200]
```

### 修改 `settings/ai_router.py` — D5 补挂门控

```python
@router.post("/ai/{stype}/{field}")
async def generate_field(..., _: bool = Depends(require_ai_access), ...):
```

## 测试

- `conftest.py` 加 `set_tier(tier, expires_at=None)` fixture：写 `DATA_ROOT/config.json`。
- 新增 `tests/test_free_bypass.py`：TE-01（tier_bypass 谓词单测）+ TE-02（HTTP 集成：free confirm/transition 放行、phase-status tier_bypass、PRO 仍拦截、过期付费旁路）。
- 新增 `tests/test_archive_free.py`（P0 部分）：无 Key 归档 200 + 摘要降级 + 免费可读 + N9 不 500 + B4 回归。
- `tests/test_settings_ai.py` 补一条：无 Key → 403（需不 override require_ai_access）。

## 风险

- 旁路条件误伤 PRO：`tier_or_gate` PRO 分支原样返回 gate_fn 的 `GateResult`，不改 hard_block 语义。
- `tier_or_gate` 对 gate_fn 的 await 约定：全部接入点为 async gate，统一 `await gate_fn(*args)`。
- 归档副作用（update_thread_state/update_character_states）保持现状，仅摘要降级 + 旁路，不动其它。
