# Settings Readiness — Design

## 接口

```
GET /api/novels/{project_id}/readiness
→ {
    "complete": false,
    "missing": [
      {"key": "synopsis", "label": "故事简介", "jump": "synopsis"},
      {"key": "genre",    "label": "题材类型", "jump": "genre"},
      {"key": "world",    "label": "世界设定", "jump": "world"},
      {"key": "anti-ai",  "label": "AI 痕迹控制", "jump": "anti-ai"},
      {"key": "hooks",    "label": "伏笔管理", "jump": "hooks"},
      {"key": "characters","label": "角色管理", "jump": "characters"}
    ],
    "warning": "还差 6 项设定，可以先补完再开始，也可以直接开始"
  }
```

## 后端

- 新增 `client/backend/workflow/readiness.py`：
  - `READINESS_CHECKERS: list[Checker]`，每项 = `(key, label, jump, async check(root_path) -> bool)`
  - `async compute_readiness(root_path) -> dict`（complete/missing/warning）
- `gates.py`：`gate_settings_complete` 改为调用 readiness 的 settings 判定，warning 中文化 + jump；`get_phase_status` 的 settings 阶段消费 readiness 结果。
- `settings/status.py`：`VALID_TYPES` 补充与 readiness 的关系说明；settings-status.yaml 不再参与判定（deprecated）。
- `workflow/router.py` 或 `novels/router.py`：新增 readiness 端点（经 `get_novel` 权限校验）。

## 前端

- `useOnboarding`：改调 `GET /novels/{id}/readiness`，删 `SETTINGS_TYPES.every` 本地确认逻辑；`allConfirmed = data.complete`。
- `GateBanner`：支持 `missing[]` 渲染（每项「去补充 →」跳转按钮）；complete 时 success 变体。
- `EmptyState`/阶段面板：软门控双按钮「先去补设定」「仍然继续」+ `bypass` 会话内旁路记忆。
- `TabProgressButton`：settings 阶段状态与 readiness 同源。

## 待拍板（实现前）

1. world `details` 子字段阈值（建议 ≥4 / 8）
2. style 判定字段（role 非空即可，或加 genre_profile）
3. anti-ai / hooks / characters 阈值确认
4. `GET /settings/status` 废弃窗口（建议保留 deprecated）

### 🔴 硬阻塞：模板默认值 vs "新项目全 missing"（后端 agent 验证发现）—— ✅ 已拍板修正 2026-08-02

骨架复制模板导致新项目**天然有内容**：`writing-style.yaml.role`（模板自带默认作家提示词）、`anti-ai.yaml`（模板含整套规则）、`hooks.yaml`（模板带 1 个空钩子）。

**产品拍板（修正前一轮"默认全空"的结论）**：
1. **设定文件保留模板默认值**（不清空骨架）。
2. **创建小说时不判定**——新项目不做完成判定，不提示未完成。
3. **判定时机 = 用户点「完成设定」（ConfirmToggle）时**：点该项时判定该内容是否达标（非空/阈值）；达标 → 确认完成；不达标 → 提示缺什么、不确认。
4. **已完成**：`filesystem/init.py` 的清空逻辑已回退（git checkout 还原），模板默认值保留。

**影响**：readiness 的触发点从"随时内容判定"改为"点完成设定时判定"；"新项目全 missing"不再作为默认状态，而是"未点完成设定 → 不判定"。

### 前端缺口（前端 agent 验证发现，需补决策）

1. **`jump="synopsis"` 落点**：设定树无 synopsis 节点。方案：切 settings tab + 默认 panel + 高亮全局简介卡；或新增 synopsis 树节点（改动大，不推荐）。
2. **ConfirmToggle 降级口径**：删 settingsStatus 后 NovelPage L565 必崩；`confirmed` 改由 readiness.missing 判断；ai-model 面板不参与判定 → 隐藏 toggle 或恒绿；`PUT /settings/status/{type}` 不再调用。**必须补进 tasks.md 前端清单**。
3. **GateBanner 数据源**：readiness.missing 与 phase-status warnings（含 outline 等其他阶段）谁为主？建议：readiness 提供 settings 缺失（含 jump），phase-status 继续提供其他阶段 warning，两者去重后渲染。

### 后端口径（后端 agent 验证发现）

- **subset 口径**：gate_settings_complete 消费全部 7 项还是只原 3 项（world/style/hooks）？建议全部 7 项（设定=7 项，与 readiness 一致）。
- **warnings/jump 契约**：GateResult.warnings 是 list[str]（gates.py:22），phase-status 是 {phase,message}（gates.py:279）——是否扩展 jump 字段、transition 是否透传 missing，需定。
- **暗坑**：test_workflow_api._prime_settings 的 world details 只填 3 个子字段，world 阈值 ≥4 时存量测试连带失败，需同步补。
