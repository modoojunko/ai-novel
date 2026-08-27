# Settings Readiness — Tasks

## 后端

- [x] **骨架保留模板默认值（已拍板修正并回退）**：`filesystem/init.py` 清空逻辑已 git checkout 还原；新项目题材/世界设定等为空是正常状态
- [ ] 新建 `workflow/readiness.py`：`READINESS_CHECKERS`（7 项非空 checker）+ `compute_readiness(root_path)`（返回 {complete, missing:[{key,label,jump}], warning}）
- [ ] 修复 world 判定 bug：`details` 子字段非空数 ≥ 阈值（重写顶层计数）
- [ ] **ConfirmToggle 判定（核心）**：`PUT /settings/status/{type}` 改为先判定该项内容——为空 → 400 + 中文提示（"该项还未填写内容"）；非空 → 写 settings-status.yaml 确认标记
- [ ] 新增 `GET /api/novels/{project_id}/readiness` 端点（get_novel 权限校验；供 ConfirmToggle 校验与门控提示）
- [ ] `gate_settings_complete` / `get_phase_status`：settings 完成状态以确认标记（settings-status.yaml）为主，readiness 内容判定作为补充提示（软门控，不阻断）
- [ ] settings-status.yaml 保持为完成标记存储（不删，语义 = 用户点完成且通过判定）
- [ ] 判定规则（非空即通过）：synopsis=story.yaml.synopsis / genre=genre.yaml.genre_id / world=details 子字段≥阈值 / style=role（模板有默认值 → 天然通过）/ anti-ai=有内容 / hooks=非空钩子≥1 / characters=目录 yaml≥1

## 前端

- [ ] `useOnboarding` 消费 readiness/确认状态：`allConfirmed` 改为基于 settings-status 确认标记（配合后端 ConfirmToggle 判定）；`isNew` 口径同步
- [ ] **ConfirmToggle 校验交互（核心）**：点击「完成设定」→ 调后端判定（PUT status 内部校验或先查 readiness）→ 为空 → toast 提示"该项还未填写内容"、不确认；非空 → 确认完成。ai-model 面板不参与判定 → 隐藏 toggle 或恒绿
- [ ] `GateBanner` 支持 missing 列表 + jump 按钮（数据源与 phase-status 去重见 design.md 前端缺口 3）
- [ ] `EmptyState` 软门控双按钮 + bypass 旁路记忆（**会话内内存态即可，持久化与否实现前定**）
- [ ] `TabProgressButton` settings 状态同源（先确认后端 phase-status 联动后前端是否零改动）
- [ ] `jump="synopsis"` 落点（design.md 前端缺口 1：切 settings + 高亮全局简介卡，实现前定方案）

## 测试

- [ ] 新增 `tests/test_readiness.py`：
  - 新项目（只书名）→ complete=false + 7 项中文 missing
  - 逐项填满 → complete=true
  - world 新规则回归（旧 bug：顶层 3 键永远不满）
  - ai-model 不影响判定
  - 软门控：complete=false 时 transition 仍放行
- [ ] `test_workflow_api._prime_settings` 补 synopsis/genre（语义对齐）
- [ ] 全量回归：pytest / tsc / build / 浏览器实测
