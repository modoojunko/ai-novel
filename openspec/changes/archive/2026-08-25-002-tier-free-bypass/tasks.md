# Tier 门控旁路 + 归档免费化 — Tasks

> BE-04 / BE-05 / BE-17 ｜ TE-01 / TE-02 / TE-03(P0) / TE-05

## 后端

- [ ] 新建 `workflow/tier.py`：`tier_bypass()` / `tier_or_gate(db, project, gate_fn, *args)` / `tier_phase_transition(project, new_phase)`（BE-04）
- [ ] `workflow/gates.py::gate_archived`：`.yaml` → `.md` 修复（B4）
- [ ] `workflow/router.py::transition_workflow`：三个 hard gate 走 `tier_or_gate`；`update_phase` 走 `tier_phase_transition`（BE-04）
- [ ] `workflow/router.py::phase_status_endpoint`：free 返 `{phases 全 complete, tier_bypass: true}`（N14）
- [ ] `chapters/router.py::create_volume`：`gate_settings_complete` 走 `tier_or_gate`（BE-04）
- [ ] `chapters/router.py::confirm_chapter`：`gate_chapter_ready` 走 `tier_or_gate`（free 放行，BE-04）
- [ ] `archive/router.py`：归档/读归档三处移除 `require_ai_access`；`update_phase("archive")` 走 `tier_phase_transition`（N9，BE-05）
- [ ] `archive/service.py`：AI 摘要 try/except 降级 `full_text[:200]`（B2/D4，BE-05）
- [ ] `settings/ai_router.py::generate_field`：补挂 `require_ai_access`（D5，BE-17）

## 测试

- [ ] `conftest.py`：加 `set_tier(tier, expires_at=None)` fixture（写 `DATA_ROOT/config.json`）
- [ ] 新增 `tests/test_free_bypass.py`（TE-01 + TE-02）：
  - `tier_bypass` 谓词：none=True / 未过期付费=False / 过期付费=True
  - `tier_or_gate` free 不 invoke gate_fn、PRO invoke 且返回原 GateResult
  - `tier_phase_transition` free 从 settings force 到 archive 不抛 ValueError；PRO 同场景抛
  - HTTP：free confirm 空 memo 章 → 200；transition write 无 prompt → 200；phase-status 带 tier_bypass
  - PRO 未过期：confirm/transition 仍被 gate 拦截 → 400（防误伤）
- [ ] 新增 `tests/test_archive_free.py`（P0 部分，TE-03）：
  - 无 Key 归档 → 200 不 500，摘要=正文前 200 字
  - `GET /archives` / `GET /archives/{filename}` 免费可读
  - 新书（settings 阶段）归档不 500（N9）
  - B4 回归：归档后 phase-status archive 阶段不再恒 in_progress
- [ ] `tests/test_settings_ai.py` 补一条：未配 Key 直呼 `generate_field` → 403（D5 回归）

## 验收

- [ ] `cd client/backend && python -m pytest tests/test_free_bypass.py tests/test_archive_free.py tests/test_settings_ai.py -v` 全绿
- [ ] `cd client/backend && python -m pytest tests/ -v` 既有测试无回归
