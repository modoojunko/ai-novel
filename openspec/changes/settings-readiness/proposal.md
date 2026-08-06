# Settings Readiness: Unified Completion Determination

## Why

作者看到的"设定是否完成"与系统判定不一致：前端确认制（6 项，点 ConfirmToggle 即完成，含 ai-model）、后端字段制（world 顶层≥5 字段 / style.role / hooks≥3，英文技术文案，不含简介/题材）。双向产生"点完还提示缺项"与"填满还说没完成"。

真实 bug：`world-setting.yaml.template` 顶层仅 3 个 key（name/summary/details），`gate_settings_complete` 却要求 `filled_fields >= 5`（`workflow/gates.py:39`）——世界观填满也永远判"未完成"。

方向已拍板：**内容判定为准**（ConfirmToggle 降级为纯 UI 展示），**ai-model 不参与**判定。

## What Changes

### readiness/spec.md (capability)

- 新增 `GET /api/novels/{id}/readiness`：返回 `{complete, missing:[{key,label,jump}], warning(中文)}`。
- 判定集合（内容判定）：synopsis / genre / world / style / anti-ai / hooks / characters，共 7 项；ai-model 不参与。
- 每项有独立纯函数 checker，统一入口 `READINESS_CHECKERS`。
- 判定规则（待实现前最终确认）：
  - synopsis：`story.yaml.synopsis` 非空
  - genre：`settings/genre.yaml.genre_id` 非空
  - world：`details` 子字段非空数 ≥ 阈值（重写现有顶层计数 bug）
  - style：`role` 非空（或与产品确认的字段）
  - anti-ai：`anti-ai.yaml` 有内容
  - hooks：hooks 列表 ≥ 1 条有效钩子
  - characters：`character-setting/` 目录 yaml ≥ 1
- `jump` 值映射前端左侧设定树节点 id（genre/world/style/anti-ai/hooks/characters），synopsis → 全局简介卡。
- `warning` 为中文引导文案（如"还差 N 项设定，可以先补完再开始，也可以直接开始"）。
- `gate_settings_complete` 重构为内部调用同一判定表（不另写一套），保持软门控（不阻断）。
- `get_phase_status` 的 settings 阶段消费 readiness；`settings-status.yaml` 不再作为判定输入（deprecated 兼容保留）。
- 软门控：`complete=false` 时前端提供「先去补设定」+「仍然继续」双选项，transition 不阻断（AC-4.3）。

## Impact

- 后端：新增 readiness 端点 + 判定表；重构 `gate_settings_complete`；`get_phase_status` 联动；settings-status deprecated。
- 前端：`useOnboarding` 改消费 readiness；`GateBanner` 支持 missing 列表 + jump + success 变体；`EmptyState` 双按钮 + bypass 旁路；Tab 状态同源。
- 测试：新增 `test_readiness.py`（新项目全 missing / 逐项填满 complete / world 新规则回归 / 中文 label-jump 对齐）；`test_workflow_api._prime_settings` 需补 synopsis/genre。
- 现有测试断言不含 gate warning 文案 → 零存量破坏。

## Rollout

1. 后端 readiness 端点 + 判定表 + gate 重构（含 world bug 修复）
2. 前端 useOnboarding/GateBanner/EmptyState/Tab 切换消费
3. 新增测试 + 全量回归（pytest / tsc / build / 浏览器实测）
