# AGENTS.md

本文件指导 Codex 主代理在本项目中**何时、如何委派任务**给 `.codex/agents/` 下的专业子代理。

## 委派总原则

- 主代理默认直接处理常规、简单任务，不随意 spawn 子代理。
- 当任务匹配下表中的任一场景，或任务的专业性/复杂度超出常规实现时，先委派对应专家代理，再汇总其结果。
- 委派时向子代理提供完整上下文：**目标、范围、相关文件/输入、期望输出格式**，而不是只丢一句话。
- 用户显式点名某个 agent 时，优先遵从用户指令，直接委派。

## 专家调度表

### 工程

| 触发场景 | 委派 agent |
| --- | --- |
| 后端架构设计、系统扩展、API 设计、微服务拆分、云基础设施选型 | engineering-backend-architect |
| 前端功能实现、页面开发、React/Vue 组件、前端性能优化 | engineering-frontend-developer |
| 代码评审：正确性、安全性、可维护性、性能 | engineering-code-reviewer |
| 数据库 schema 设计、索引与查询优化、慢查询排查 | engineering-database-optimizer |
| CI/CD 流水线、部署自动化、基础设施即代码 | engineering-devops-automator |
| 提示词设计/优化、LLM 行为调优、prompt 文件管理 | engineering-prompt-engineer |

### 产品与项目

| 触发场景 | 委派 agent |
| --- | --- |
| 产品需求分析、路线图、商业目标对齐 | product-manager |
| 功能排序、迭代/冲刺规划、需求优先级（RICE、MoSCoW 等） | product-sprint-prioritizer |
| 跨职能项目协调、时间线管理、交付护航 | project-management-project-shepherd |

### 设计与用户体验

| 触发场景 | 委派 agent |
| --- | --- |
| 品牌形象、视觉一致性 | design-brand-guardian |
| 界面视觉设计、组件库、像素级 UI 实现 | design-ui-designer |
| CSS 体系、布局框架、UX 技术架构 | design-ux-architect |
| 用户行为研究、可用性测试、设计洞察 | design-ux-researcher |
| 用户画像认知走查、转化率优化（LIFT/Cialdini/Fogg） | design-persona-walkthrough |

### 测试

| 触发场景 | 委派 agent |
| --- | --- |
| Playwright/Cypress 端到端测试、消除 flaky、CI 测试并行化 | testing-test-automation-engineer |

## 本项目的典型协作场景

- **新功能从 0 到 1**：product-manager 梳理需求与商业目标 → product-sprint-prioritizer 做优先级排序 → project-management-project-shepherd 制定时间线与协调交付 → 再进入工程/设计实现。
- **六阶段创作流程（init → settings → outline → prompt → write → archive）**：涉及创作提示词的设计与调优时，委派 engineering-prompt-engineer。
- **一次完整功能开发**：先 engineering-backend-architect 定架构 → engineering-frontend-developer 实现 → engineering-code-reviewer 评审 → testing-test-automation-engineer 补 E2E。
- **页面/体验改版**：design-ux-researcher 做研究 → design-ux-architect 定布局框架 → design-ui-designer 出视觉 → design-persona-walkthrough 做认知走查。

## 委派执行方式

- 使用 Codex 的子代理机制（spawn agent）执行委派，子代理与主代理共享同一工作区与工具。
- 子代理完成后的产出必须由主代理验证并整合进最终交付。

## 当前进行中的任务（临时调度表，交付后移除）

以下为本次开发委派的任务简报。如果你的任务名与下表某项匹配，立即读取对应简报文件并严格执行其中任务；执行过程中不得改写本文件。任务名不在表中的代理忽略本节。

| 任务名 | 简报文件 |
| --- | --- |
| frontend_ux_v3 | agent-tasks/brief_frontend.md |
| backend_draft_v2 | agent-tasks/brief_backend.md |
| backend_draft_v3 | agent-tasks/brief_backend.md |
