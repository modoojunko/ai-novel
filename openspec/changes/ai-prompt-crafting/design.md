# Design: ai-prompt-crafting

## Context

- 现状整章组装在 `write/chapter_writer.py`（`ChapterContext`），分段组装在 `prompt/assembler.py`（`chapter_segment.prompt` 模板），双轨数据源各自为政；分段提示词只有 `/prompts/generate` 生成与 PromptManagementPage 展示，无正文生成消费方。
- 正文五连在 `write/router.py`（write 流式 + prompt_override 覆盖机制 + `write-prompt` 持久化），质检 `write/quality.py` 是**确定性规则扫描**（疲劳词/句式/对话占比/描写占比），不是 LLM。
- 章数据模型 `models/chapter.py`：主表标量 + 11 子表，`chapters/store.py` 负责章 JSON ↔ 表拆装；存量库靠 lifespan 幂等 DDL 升级（先例：`projects.index_status` 的 ALTER try/except）。
- 用户四项拍板（本次设计的硬输入）：① 章纲新格子全加（场景卡 weight/focus、micro_payoffs、ladder_exit、文风 few_shot）；② 正文三工序全吸收（目标字数/铁律/写后自查）；③ 分段提示词退役，一章一个提示词；④ 提示词 = 程序组装素材 + **大模型润色**，作者确认后基于它生成正文。
- 不依赖 `feat/story-arc-planning` 分支：主线相关输入（如 planned_volumes.arc_position）有则消费、无则跳过。

## Goals / Non-Goals

**Goals:**

- 提示词生产两段式：确定性素材包（可测试、可降级）→ 大模型润色（承载 awesome-novel 的骨架/优先级/质感要求这类「需要判断力」的 craft）。
- 正文生成工序闭环：目标字数消费、铁律注入、写后自查清单、字数差距显式提示。
- 分段链路干净退役，整章提示词成为唯一事实。

**Non-Goals:**

- AI 生成章纲新格子内容（留下个 change，随 AI 章纲一起）。
- 写作记忆 / 提示词记忆 / 文风量化蒸馏 / 场景风格卡（awesome-novel 的 memory 与 style-profiles，后置迭代 C）。
- 卷阶梯层位 ladder_position 与章内小阶梯 ladder_steps 子表（不在本次拍板范围；润色时大模型可从场景卡自行推导障碍递进，不依赖显式字段）。
- 归档更新回路（lore-keeping，迭代 B）。

## Decisions

### D1 两段式管线：素材包 + 润色，而非全交给 LLM 或纯模板

- **素材包组装层**（确定性，重构 `ChapterContext` 为 `build_material(root_path, chapter_ref)`）：从 DB 拼结构化素材（文风含 few_shot、题材、世界观 ≤600 字、反AI、前提、卷概要、章纲全字段含新格子、前情上下文、角色 ≤5、伏笔 ≤8），同时能渲染一版「粗组提示词」作为润色失败/未润色时的兜底。
- **润色层**（LLM）：新增模板 `prompts/prompt_crafting.prompt` 作为系统指令——十段骨架、红线优先级（红线 > 字数 > 疲劳词句式 > 题材禁忌 > 文风规范）、±10% 压缩策略、质感「不完美」约束、铁律引用；用户消息 = 素材包。产物覆盖写回 `chapter_prompts`（name=`write-prompt`，复用现有行）。
- 理由：素材包确定性可单测（pytest 对拍字段）；润色层专注「怎么写好」的判断；两层任一失败都能降级（润色失败 → 粗组兜底；组装失败 → 报错）。
- 替代方案否决：纯 LLM 直接读库（不可测、token 失控）；纯模板拼接（用户已明确否决——「不是程序硬组装」）。

### D2 前情上下文升级的取数链

- 前情构造顺序：上章章纲情绪设计（`mood_progression` 末段 + `emotional_hook` + `required_changes` 摘要 + `ladder_exit`）→ 附读者期待缺口（`expectation_state/detail`）→ 可选上章正文末 ≤300 字。第一章固定句「无前置章节，开篇直接切入角色当下行动」。
- 回退链：上章 `outline_status=unfilled` 或章纲关键字段全空 → 现行为（上章正文末段）；连正文都没有 → 第一章口径。
- 卷首章（vol-N-ch-1, N>1）也按「有上一章」处理（读上一卷末章），与现行为一致。

### D3 分段退役清单（破坏面控制）

- 后端删：`prompt/assembler.py`、`prompt/router.py` 的 `POST /prompts/generate`、`prompts/chapter_segment.prompt`。
- 后端改：`GET/PUT /prompts/{seg}` 保留路径形态但收敛语义——`{seg}` 仅接受 `write`（读/写 `write-prompt` 行），其余 404；对外仍呈现 `{ref}-write-prompt.md` 文件名形态（前端零改动的既有约定延续）。
- 存量 `seg-N-prompt` 行不迁移不删除，读端点不再返回它们（列表端点只回整章一条）。
- 前端：PromptManagementPage 重写为整章单卡（内容 + 编辑保存 + 「AI 润色」按钮 + 状态徽标），PromptPane 壳不变；相关 e2e 用例同步改（`workbench-3-label` 既有断言「分段生成按钮」的用例改为整章断言）。

### D4 润色端点与生成弹窗的两段式交互

- 新端点 `POST /api/novels/{project_id}/chapters/{chapter_ref}/prompt/polish`：`require_ai_access` 门控；内部组装素材包 → 调 `get_ai_client().chat`（model 取 `style.writing_model`，缺省 haiku 同现状）→ 产物写 `chapter_prompts`；返回 `{prompt}`。失败不清空既有行。
- `GET /write/prompt` 语义改为**存量优先**：有 `write-prompt` 行则返回它；无则返回粗组兜底并带 `polished: false` 标记，前端提示「未润色，建议先 AI 润色」。
- 生成弹窗（AiModal）：打开即展示存量/粗组 → 「AI 润色」按钮（弹窗内直接调 polish，流式与否取决于实现，首版非流式+loading 即可）→ 编辑 → 「生成正文」。`prompt_override` 覆盖机制原样保留。
- 理由：复用既有 `write-prompt` 行与覆盖机制，改动集中在「值的来源」而不是存储结构。

### D5 正文三工序的落点

- **目标字数**：素材包与润色指引注入 `word_target`（缺省 2500 兜底）+「±10% + 压缩策略」文本；`_stream_chapter` 完成事件新增 `word_check: {target, actual, below_limit}`（低于 90% 时 `below_limit: true` 并附「字数不足：目标 X 实写 Y」文案），前端完成 toast/横幅展示。
- **铁律**：双重注入——润色指引要求产物末尾保留「写作铁律」段；`_stream_chapter` 的 system/首段再注入一份固定铁律文本（防人工编辑提示词时误删）。铁律内容：只输出正文、无标题/解释/引导语/Markdown 标记、未写情节不自行添加、龙套泛指不命名。
- **写后自查**：扩展 `write/quality.py` 为确定性叙事扫描（与现有五项检查并列）：认知动词计数（意识到/发现/感到/明白/觉得/认为，>2 处命中即报）、段首「主角+感知动词」结构、因果连接词密度（因为/所以/因此）、Markdown 标记与引导语残留（铁律验收）、「先→然后→接着→最后」流水账结构、泛化标签词（各种/纷纷/一系列）。生成完成事件附 `self_check` 清单（规则名 + 原句摘录）；手动 quality-check 端点同享扩展。
- 理由：awesome-novel 的自查是 agent 通读，ai-novel 用确定性扫描（零 token、可单测、e2e 可断言）；语义级深检（对话是否符合角色）不在确定性能力内，交由润色指引约束生成侧。

### D6 数据模型与迁移

- `models/chapter.py`：`Chapter.ladder_exit String(300) nullable`；`ChapterSceneCard` 加 `weight String(10)` / `focus String(50)`（可空，服务层校验枚举）；新 `ChapterMicroPayoff(_ChapterChildMixin)`（kind/description/location）+ relationship。
- lifespan 幂等 DDL：`ALTER TABLE chapters ADD COLUMN ladder_exit TEXT`、`ALTER TABLE chapter_scene_cards ADD COLUMN weight TEXT` / `focus TEXT`（try/except 先例），`chapter_micro_payoffs` 走 `create_all`；二次启动 no-op。
- `chapters/store.py` 拆装：章 JSON 新键 `ladder_exit`（标量）、`scene_cards[].weight/focus`、`micro_payoffs[]`；`ChapterMicroPayoff` 行的 sort_order 语义与其他子表一致。
- 文风 few_shot：`project_settings` 的 style KV 加 `few_shot_examples: string[]`（读侧容错，无 DDL）。

### D7 前端格子与表单

- OgPane：场景卡行内加 weight（分段选择 高/中/低）与 focus（核心冲突/人物情绪/信息差）紧凑控件；章纲 memo 区加「读者获得」列表编辑（类型下拉 7 枚举 + 描述输入 + 位置三分段）与「章末落点」单行输入；确认时缺读者获得给非阻断提醒（存量章不回溯）。
- 设定-文风表单：加「文风例句」1-3 条多行输入。
- 复用既有表单组件与保存链路（`useChapterData`/`useOutline` 契约只增字段不改形态），vitest 本地全量跑（CI 不跑前端测试的既有坑）。

## Risks / Trade-offs

- [润色产物质量不稳（骨架缺段/夹带 meta 说明）] → 润色系统指令中列明骨架清单与「不合格」标准；落库前做轻校验（必备段关键词探测），不合格直接报错重试而非静默落库。
- [润色多一次 AI 调用，生成链路变长] → 润色一次落库长期复用（改章纲才需重润）；弹窗内存量优先，不强制每次润色。
- [`GET /write/prompt` 语义变化影响既有调用方] → 响应结构向后兼容（`prompt`/`has_outline` 键保留，新增 `polished`）；e2e 同步核对。
- [分段退役误伤存量用户习惯] → 拍板已明确单轨；存量 seg 行保留在库不展示，不做数据删除；提示词面板文案说明「一章一个提示词」。
- [word_target 被人工改到极端值（如 20000）] → 服务层夹取 [500, 6000] 区间（与现有模型输出能力匹配），越界值按默认处理并提示。
- [自查误报（认知动词在关键情绪节点属合法 ≤2 次）] → 清单明示「提示性质，不阻断」，阈值对齐 awesome-novel 口径（>2 报警）。

## Migration Plan

1. 后端先落（模型迁移 + 素材包 + 润色端点 + 退役分段），前端后落（弹窗两段式 + 面板单卡 + OgPane 格子）。
2. 存量库：启动幂等 DDL 自动升级；无数据回填（新格子全可空）。
3. 回滚：新列/新表可留存无害；端点回退即恢复旧组装路径；分段链路删除后如需恢复走 git revert。

## Open Questions

- 润色是否需要流式（首版非流式 + loading；若用户反馈长等待再升级 SSE）。
- 「AI 润色」在提示词面板与生成弹窗两处入口都放还是只放弹窗（首版两处都放，同一端点）。
