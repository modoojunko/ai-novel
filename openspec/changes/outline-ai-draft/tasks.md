# Tasks: outline-ai-draft

## 1. 后端

- [x] 1.1 新增 `client/backend/prompts/outline_draft.prompt`：system 提示词，约束只输出 JSON、全字段清单（outline/memo/emotional_design/segments/scene_cards/micro_payoffs/ladder_exit/word_target）、枚举值表与字数口径（word_target 500-6000 缺省 2500、段落 3-6 段）
- [x] 1.2 新增 `client/backend/chapters/ai_draft.py`：`POST /api/novels/{project_id}/chapters/{chapter_ref}/outline/ai-draft`，auth 三件套（get_current_user/require_ai_access/get_db）+ `_validate_ref` + 404 语义
- [x] 1.3 实现素材汇集：复用 `build_chapter_context`（前情/设定）+ 主线卡（story arc key）+ 本章现有章纲作改写基底；无主线卡返回 422 提示先完成主线，不调模型不计量
- [x] 1.4 实现解析与校验：剥 code fence → json.loads → 骨架校验（summary/current_task/segments 缺失 502 可重试）→ 枚举/word_target 兜底（与 chapterForm 回读同口径）→ 返回 ChapterData 形状 dict
- [x] 1.5 接入计量 `record_usage(operation="outline_draft")`，模型取 style_setting.writing_model，tokens 进出如实

## 2. 后端测试

- [x] 2.1 `tests/test_outline_ai_draft.py`：成功路径返回结构化草稿且章数据/status 不变（不落库）；无 AI Key 403；无主线卡 422 且无用量记录；非法 JSON 502；枚举非法回落/clamp；计量入账
- [x] 2.2 容器内全量 pytest + ruff 绿（镜像已烘焙模板）

## 3. 前端

- [x] 3.1 `lib/ai.ts` 增 `draftOutline(projectId, chapterRef)` 封装
- [x] 3.2 OgPane 面板头加「AI 起草」按钮：免费态隐藏（与提示词子 label 同口径）；loading 防重复；表单有内容时 confirm
- [x] 3.3 ChapterWorkspace 接线：请求成功后 `setOgForm(ogToForm({...serverData, ...draft}))`（title 保留服务端值），ogSnapRef 置回填前快照；失败 toast 错误消息表单不动
- [x] 3.4 vitest：回填映射纯函数用例（草稿字段覆盖/保留字段/枚举兜底）

## 4. e2e 与验收

- [x] 4.1 e2e 打桩 AI 响应：空章纲起草回填 → 保存 → 回读一致；已有内容 confirm 流程；失败 toast；免费态入口隐藏
- [x] 4.2 docker 栈全量 e2e（52+ 用例）绿；tsc/vitest/design-lint 绿
- [x] 4.3 PR 走查：对照 spec 逐条 Scenario 验收，含「起草后章数据不变」「ogFormIssues 照常拦截回填内容」
