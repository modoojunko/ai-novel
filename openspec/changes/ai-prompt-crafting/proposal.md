# Proposal: ai-prompt-crafting — 提示词 AI 润色 + 正文生成工序

## Why

当前「AI 生成正文」的提示词由代码硬拼（ChapterContext 一次性格式化），字段语义单薄：前情只取前章正文末 500 字、章纲只注 summary + key_points 前 5 条、字数硬编码「约 2500 字」（章纲的 word_target 不生效），awesome-novel 的核心资产——场景权重笔墨分配、爽点设计、章末落点、红线优先级、质感要求——全都没有承载。对标 awesome-novel 的 prompt-crafter（LLM 读十类素材手工 craft 提示词）与 writer（写前铁律 + 写后自查），ai-novel 缺的正是「大模型润色提示词 → 作家确认 → 基于确认提示词写正文」这条生产线，同时分段提示词与整章组装双轨漂移且分段无任何正文生成消费方。

## What Changes

- **提示词生产改为两段式**：程序从 DB 确定性组装「素材包」（设定 + 章纲全字段 + 升级后的前情上下文 + 新字段），再由**大模型润色成成品提示词**（新 AI 端点，会员门控）；作家查看/编辑确认后，正文生成以该提示词为准。
- **前情上下文来源升级**：从「前章正文末 500 字」升级为「上章章纲情绪设计（mood_progression 末段 + emotional_hook + required_changes + 章末落点 ladder_exit）」，可选附前章正文末段；第一章固定「无前置章节，开篇直接切入角色当下行动」；上章章纲缺失时回退现行为（兼容旧书）。
- **章纲补一组喂提示词的新格子**（人工可填可改，AI 生成能力不在本 change）：场景卡权重 weight（高/中/低）与焦点 focus（核心冲突/人物情绪/信息差）、读者获得 micro_payoffs（类型 + 内容 + 位置）、章末落点 ladder_exit；文风补 few_shot_examples 例句（提示词「案例」段消费）。
- **提示词内容骨架升级**：润色产物覆盖角色定位 / 任务指示（含字数 ±10% 与压缩策略、叙事目标：悬念 + 读者情绪 + 爽点设计）/ 前情上下文 / 角色初始状态 / 故事背景 / 场景原材料（含权重笔墨分配）/ 案例 / 不可违反规则（红线 > 字数 > 疲劳词句式 > 题材禁忌 > 文风规范的优先级重排）/ 质感要求（「不完美」约束）。
- **正文生成吸收 awesome-novel writer 三道工序**：按目标字数写（word_target ±10%，写完校验差距并显式提示，不再静默接受）；写作铁律注入（只输出正文、禁 Markdown 标记/引导语、提示词未写的不自行添加、龙套不命名）；写完叙事自查（7 条叙事规则对照，产出问题清单）。
- **分段提示词退役**：一章一个提示词；移除分段组装/生成端点与 chapter_segment 模板，提示词面板从分段文件列表简化为整章提示词查看 + 编辑 + AI 润色入口。**BREAKING**：`POST /prompts/generate`（分段批量生成）下线，存量 seg-N-prompt 数据不再生成也不再展示。

## Capabilities

### New Capabilities

- `prompt-crafting`: 提示词生产管线——素材包确定性组装（含前情来源升级与裁剪预算）、大模型润色、作家确认与编辑、章纲新格子的存储与编辑入口。
- `prose-writing`: 正文生成工序——按目标字数生成与字数差距显式提示、写作铁律注入、写后叙事自查清单、基于确认提示词生成。

### Modified Capabilities

- `volume-chapter-index`: chapters 表加 ladder_exit 列、chapter_scene_cards 加 weight/focus 列、新子表 chapter_micro_payoffs（存量库幂等 DDL）。
- `workbench-3-label`: 提示词子 label 的内容从分段提示词文件列表（PromptManagementPage）改为整章提示词的单轨视图（查看/编辑/AI 润色）；PRO-only 口径维持。

## Impact

- **后端**：`write/chapter_writer.py`（ChapterContext 重构为素材包组装 + 前情升级）、新 AI 润色端点（走 `require_ai_access`）、`prompt/assembler.py` 与 `prompt/router.py` 分段链路退役、`write/quality.py`（叙事自查并入）、`write/router.py`（write 流字数目标消费 + 写完校验）、`prompts/chapter_segment.prompt` 删除并新增润色模板、章纲模型 `models/chapter.py` 加列加表、`chapters/store.py` 拆装适配。
- **前端**：AI 生成正文弹窗升级两段式（润色 → 确认 → 生成）、PromptPane/PromptManagementPage 单轨化、OgPane 新格子控件（weight/focus/micro_payoffs/ladder_exit）、设定文风表单 few_shot_examples。
- **会员口径**：AI 润色与正文生成均为会员 AI 能力（`require_ai_access`）；提示词面板维持 PRO-only（现状不动）。
- **依赖与边界**：不依赖 `feat/story-arc-planning` 分支（主线 arc_position 等字段有则消费、无则跳过）；AI 生成章纲新格子、写作记忆、文风量化蒸馏（awesome-novel 的 memory/style-profiles）不在本 change，后置迭代。
