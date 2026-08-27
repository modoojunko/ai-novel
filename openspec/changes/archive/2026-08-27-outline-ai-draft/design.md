# Design: outline-ai-draft — 章纲 AI 起草

## Context

章纲是提示词工坊的素材来源，目前纯手填。本变更在章纲面板加「AI 起草」：后端汇集素材调模型产出结构化章纲草稿，前端回填表单，作者修改后走既有保存/确认链路。复用三处既有模式：story/arc_wizard 的「AI 干一活 + 结构化产出 + 不落库」、prompt_polish 的「校验失败 502 可重试」、settings/ai_router 的素材组装与计量口径。

## Goals / Non-Goals

- Goals：章纲全格子（含 #198 新格子 scene_cards/micro_payoffs/ladder_exit/word_target）AI 一次起草；回填不落库；失败可重试；计量入账。
- Non-Goals：不做批量多章起草；不改必填口径与确认门；不做续写段落复检（另议）；不缓存草稿（失败即丢，重试重生成）。

## Decisions

### D1 后端形态：chapters 路由 + 独立 service 模块

`POST /api/novels/{project_id}/chapters/{chapter_ref}/outline/ai-draft`，实现在 `chapters/ai_draft.py`（与 chapters 现有 router 同目录，避免新顶层包）。依赖注入与错误语义照抄 prompt 润色端点：`get_current_user + require_ai_access + get_db`，404/422 由 `_validate_ref`/章节查询产生。

### D2 素材汇集（build_draft_context）

按可得性组装 Markdown 素材包，直接复用 `write/chapter_writer.build_chapter_context` 已汇集的前情（前章归档摘要）与设定上下文，另加主线卡（story arc key，novel 服务读取 JSON）与本章现有章纲（`load_chapter` 已有数据序列化，作改写基底）。首章/无归档时前情段整段省略（与素材包口径一致：有原料才出段）。

### D3 提示词与输出契约

新增 `prompts/outline_draft.prompt`（system）：要求只输出 JSON、字段清单与口径（word_target 500-6000 缺省 2500、场景卡/读者获得枚举值表、段落规划 3-6 段带 target_words）。模型取 `style_setting.writing_model`（与润色同源），max_tokens 4000。

解析：剥 code fence → `json.loads` → 字段级校验：
- 骨架必备：outline.summary、memo.current_task、segments（≥1 段）——缺失即 502「草稿结构不完整，可重试」。
- 枚举兜底复用 chapterForm 回读同口径（weight/focus 非法清空、kind 回落 clue、location 清空）。
- word_target 越界 clamp 500-6000，非法置 null。

校验通过的 dict 直接作为响应体（字段名与 ChapterData 一致，前端零转换）。

### D4 前端：OgPane 入口 + ChapterWorkspace 回填

- OgPane 面板头加「AI 起草」按钮（免费态隐藏，与提示词子 label 同口径）；表单有内容时 `window.confirm`（沿用确认族惯例）。
- `lib/ai.ts` 增 `draftOutline(projectId, ref)`。
- 回填走 `setOgForm(ogToForm({ ...serverData, ...draft }))`：以服务端数据为底、草稿覆盖章纲格子字段（title 保留服务端值，草稿不改章名）。回填后 ogSnapRef 置为草稿前的快照，使 3s 自动保存与「未保存」指示正常工作。
- 起草中按钮 loading 防重复提交；失败 toast 后端消息。

### D5 计量

`record_usage(operation="outline_draft")`，模型/tokens 从 chat usage dict 取，与 prompt_polish 完全同构。无迁移。

## Risks / Trade-offs

- 模型 JSON 漂移：骨架校验 + 502 重试兜底；枚举/字数兜底不阻断。
- 素材包过大（长篇设定多）：沿用 build_chapter_context 的既有截断口径，不新增处理。
- 覆盖式回填丢作者手填：二次确认 + 回填不落库（撤回 = 不保存）。

## Migration Plan

纯增量端点 + 前端入口，无数据结构变更，无迁移。回滚 = 隐藏入口。

## Open Questions

无（word_target 缺省 2500 与前端 placeholder 一致；主线卡字段名以 story arc key 现状为准，实现时对齐）。
