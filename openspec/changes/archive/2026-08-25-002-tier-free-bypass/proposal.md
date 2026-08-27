# Tier 门控旁路 + 归档免费化（002-tier-free-bypass）

## Why

PRD v1.1 定位「免费 = 完整人工写作能力」。现状后端把「六阶段 gate 门控」「归档」全挂付费/AI 语义，导致免费用户被阶段门控卡死，甚至**免费归档直接 500**：

- **N9 免费归档 500（根因）**：`archive/router.py:42` 调 `update_phase(project, "archive")`，而新书 `current_phase="settings"` 时 `can_transition("settings","archive")` 为 False → `engine.py:26-34` 抛 `ValueError` → 500。免费用户第一本书（settings 阶段）写完后无法归档。
- **B2/D4 归档无 Key 500**：`archive/service.py:37` 无条件 `await get_ai_client()`，未配 API Key 时 `AIClient.__init__` 抛 `ValueError("未配置 API Key")` → 归档 500。归档是免费能力，不应依赖 AI Key。
- **B4 gate_archived 恒 in_progress**：`workflow/gates.py:161-174` 查 `archives/*.yaml`，但归档实际落盘是 `.md` → archive 阶段永远判未归档。
- **D5 AI 端点漏门控**：`settings/ai_router.py:79` `generate_field` 漏挂 `require_ai_access` → 免费无 Key 直呼可绕过。

## What Changes

### 新增能力 `tier-access`

1. `workflow/tier.py`：
   - `tier_bypass()` → 当前**无付费权益**（`tier=="none"` **或** 过期付费 `check_permission().allowed==False`）时返回 True，非裸 tier 字符串判断。
   - `tier_or_gate(db, project, gate_fn, *args)` → free 恒返回 `GateResult(valid=True, warnings=[], hard_block=False)`（不 invoke gate_fn）；PRO 走现状 `gate_fn(*args)`。
   - `tier_phase_transition(project, new_phase)` → free 下 `update_phase` **跳过 `can_transition` 校验（force 模式）**，PRO 走现状。
2. 接入点统一收口（杜绝逐点 `if(tier)`）：
   - `create_volume`：`gate_settings_complete` 走 `tier_or_gate`。
   - `confirm_chapter`：`gate_chapter_ready` 走 `tier_or_gate`（free 放行）。
   - `workflow/transition`：三个 hard gate 走 `tier_or_gate`；`update_phase` 走 `tier_phase_transition`。
   - `archive`：`update_phase("archive")` 走 `tier_phase_transition`（N9）。
   - `phase-status`：free 追加 `tier_bypass: true` 且 phases 全 `complete`（不展示不催促，N14）。
3. **修复 B4**：`gate_archived` 查 `.md`（DB 表未就绪时降级现状文件扫描，不 500）。

### 修改能力 `archive`（免费化）

4. `archive/router.py`：`POST /chapters/{ref}/archive`、`GET /archives`、`GET /archives/{filename}` **移除 `require_ai_access`**（归档只读闭环 = 免费能力）。
5. `archive/service.py`：AI 摘要**降级**——`get_ai_client()` 抛 `ValueError`（未配 Key）或 `client.chat` 异常时，捕获并回退 `full_text[:200]` 作 `archive_summary`；有 Key 才调 AI。

### 修改能力 `settings-ai`（门控补全）

6. `settings/ai_router.py::generate_field` 补挂 `_: bool = Depends(require_ai_access)`（D5）。`generate_all_settings` 已挂，不动。

## Impact

- 后端：新增 `workflow/tier.py`；改 `workflow/gates.py` / `workflow/router.py` / `chapters/router.py` / `archive/router.py` / `archive/service.py` / `settings/ai_router.py`。
- 测试：新增 `tests/test_free_bypass.py`、`tests/test_archive_free.py`（P0 部分）；`tests/conftest.py` 加 `set_tier` fixture；`tests/test_settings_ai.py` 补一条未配 Key → 403。
- 兼容：PRO 语义不变——`tier_or_gate` PRO 分支原样返回 `gate_fn` 的 `GateResult`；`tier_phase_transition` PRO 分支与 `update_phase` 完全等价。免费 `current_phase` 仍幂等推进（O3），`can_transition` 校验仅被旁路、不删除。

## Rollout

1. `workflow/tier.py` + `gate_archived` B4 修复 + `workflow/router.py` 接入（BE-04）
2. 归档免费化（`archive/router.py` + `archive/service.py` 摘要降级，BE-05）
3. `generate_field` 补挂 `require_ai_access`（BE-17）
4. 新增测试（`test_free_bypass` / `test_archive_free` P0 / `test_settings_ai` 补一条）+ 全量回归 pytest
