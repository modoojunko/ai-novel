# Proposal: outline-ai-draft — 章纲 AI 起草

## Why

创作流水线中，建书（元数据建议）、设定（子项填充 + 主线拆纲向导）、提示词（两段式润色）、正文（生成 + 三工序质检）、归档（AI 摘要）均已有 AI 参与，唯独**章纲阶段是纯手工**：作者要从主线卡和设定里自己搬素材，逐格填核心任务、段落规划、场景卡、读者获得、章末落点等十余项。章纲是提示词工坊的素材来源，手填成本高且质量不稳，是链条里最重的断点。

## What Changes

- 新增后端端点 `POST /api/novels/{project_id}/chapters/{chapter_ref}/outline/ai-draft`：
  - 汇集素材包：主线卡（story arc key）、设定摘要、前情（同章前章归档摘要）、本章现有章纲（若有，作为改写基底）。
  - 调大模型生成章纲草稿，返回结构化 JSON（覆盖 ChapterData 的 outline/memo/emotional_design/segments/scene_cards/micro_payoffs/ladder_exit/word_target 全部章纲格子，含 #198 新格子）。
  - 产出**不落库**：只返回草稿，由前端表单承接，作者修改后走既有保存/确认链路（含 ogFormIssues 校验）。
- 新增提示词 `outline_draft.prompt`（系统提示词，约束 JSON 输出结构与字数口径）。
- 前端章纲面板（OgPane）新增「AI 起草」入口：
  - 章纲为空 → 一键起草；已有内容 → 二次确认（覆盖式回填表单，不直接保存）。
  - 回填进表单而非直接落库，作者可见可改，沿用现有 ogGaps/ogFormIssues/确认链路。
- 计量：`record_usage(operation="outline_draft")`，与既有 AI 操作同口径。

不改动：章纲必填口径（ogGaps 六项）、确认门、提示词工坊链路、既有章纲手填路径（AI 起草纯增量）。

## Capabilities

- **New Capabilities**: `outline-ai-draft`（章级章纲 AI 起草：素材汇集、草稿生成、表单回填、不落库语义、计量）
- **Modified Capabilities**: `workbench`（章纲面板新增 AI 起草入口与回填交互）

## Impact

- 后端：`chapters/` 新增 ai-draft 路由 + service；`prompts/` 新增 outline_draft.prompt；计量表新增一种 operation（无需迁移）。
- 前端：OgPane 增加入口与回填；`lib/ai.ts` 增 API 封装；e2e 增用例（打桩 AI 响应）。
- 风险：模型输出 JSON 结构漂移 → 服务端做字段级校验/兜底（非法枚举回落、缺字段置空），校验失败返回 502 可重试，与 prompt_polish 同模式。
