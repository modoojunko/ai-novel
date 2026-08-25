# Tasks: ai-prompt-crafting

## 1. 数据模型与迁移（章纲新格子）

- [x] 1.1 `models/chapter.py`：`Chapter.ladder_exit`（String(300) nullable）、`ChapterSceneCard` 加 `weight`/`focus` 可空列、新增 `ChapterMicroPayoff`（kind/description/location + `_ChapterChildMixin`）与 relationship；容器内跑 `pytest` 确认模型层用例绿
- [x] 1.2 lifespan 幂等 DDL：`ALTER TABLE chapters ADD COLUMN ladder_exit TEXT`、`chapter_scene_cards` 加 weight/focus（try/except 先例）、`chapter_micro_payoffs` 走 create_all；用旧 schema 库启动两次验证幂等（第二次 no-op）
- [x] 1.3 `chapters/store.py` 拆装：章 JSON 新键 `ladder_exit`、`scene_cards[].weight/focus`、`micro_payoffs[]`（sort_order 语义与其他子表一致）；pytest 增拆装往返用例（新键存取 + 旧 JSON 无新键不报错）

## 2. 素材包组装层（前情升级 + 新字段消费）

- [x] 2.1 重构 `write/chapter_writer.py`：`ChapterContext` 升级为素材包 + 粗组兜底渲染（消费 few_shot/weight/focus/micro_payoffs/ladder_exit），删除硬编码「约 2500 字」改 `word_target`（缺省 2500，服务层夹取 [500, 6000]）
- [x] 2.2 前情上下文升级：上章章纲情绪设计（mood_progression 末段/emotional_hook/required_changes/ladder_exit + expectation）→ 可选上章正文末 ≤300 字；ch-1 固定句；上章无章纲回退正文末段；pytest 覆盖三分支（章纲完整/无章纲有正文/第一章）
- [x] 2.3 裁剪预算与占位符守卫：世界观 ≤600 字、伏笔 ≤8、角色 ≤5、few_shot 空跳过案例段、未填字段不产生 `{...}` 占位符；pytest 断言粗组产物无占位符且长度预算生效

## 3. AI 润色端点

- [x] 3.1 新模板 `prompts/prompt_crafting.prompt`：系统指令含十段骨架清单、红线优先级、±10% 压缩策略、质感「不完美」约束、铁律引用、不合格标准（必备段缺失即不合格）
- [x] 3.2 `POST .../prompt/polish` 端点（`require_ai_access`）：素材包 → `get_ai_client().chat`（model 取 `style.writing_model` 缺省 haiku）→ 轻校验（必备段关键词探测，不合格报错可重试）→ 覆盖写 `chapter_prompts`（name=`write-prompt`）；失败不清空既有行；免费用户 403 口径与既有 AI 端点一致；pytest 契约用例（成功/免费拦截/校验失败/模型错误）
- [x] 3.3 `GET /write/prompt` 改存量优先：有 `write-prompt` 行返回它并带 `polished: true`，无则粗组兜底 `polished: false`；响应保留 `prompt`/`has_outline` 键向后兼容；pytest 用例覆盖两态

## 4. 正文生成三工序

- [x] 4.1 铁律注入：`_stream_chapter` system/首段注入固定铁律文本（纯正文/无 Markdown/无引导语/未写情节不加/龙套泛指）；pytest 断言发送给模型的 prompt 含铁律段
- [x] 4.2 字数校验：完成事件新增 `word_check: {target, actual, below_limit}`（<90% 为 true + 「字数不足：目标 X 实写 Y」文案），正文照常落库；pytest 用例（不足/达标）
- [x] 4.3 叙事自查：扩展 `write/quality.py` 确定性扫描——认知动词计数（>2 报）、段首「主角+感知动词」、因果连接词密度、Markdown/引导语残留、流水账结构、泛化标签词；输出规则名 + 原句摘录清单；生成完成事件附 `self_check`；pytest 覆盖每条规则的命中与干净正文空清单

## 5. 分段链路退役（后端）

- [x] 5.1 删 `prompt/assembler.py`、`POST /prompts/generate`、`prompts/chapter_segment.prompt`；`GET/PUT /prompts/{seg}` 收敛 `{seg}` 仅接受 `write`（读写 `write-prompt` 行），其余 404；列表端点只回整章一条；存量 seg 行不迁移；pytest 更新受影响契约用例
- [x] 5.2 全库 grep 确认无 `assemble_segment`/`chapter_segment` 残留引用（含 tests 与 e2e fixtures）；容器内 `pytest` 全量绿（模板已入镜像，免挂载）

## 6. 前端：章纲新格子 + 文风例句

- [x] 6.1 OgPane：场景卡行内 weight（高/中/低）与 focus（核心冲突/人物情绪/信息差）控件、memo 区「读者获得」列表（7 类型枚举 + 描述 + 前中后位置）与「章末落点」输入；确认时缺读者获得非阻断提醒；保存链路走 `useChapterData`/`useOutline` 既有契约；vitest 组件用例（填值保存回读、存量空值不警告）
- [x] 6.2 设定-文风表单加「文风例句」1-3 条编辑（style KV `few_shot_examples[]`）；vitest 用例；`lib/api` 消费方改动后本地全量 `vitest`（CI 不跑前端测试）
- [x] 6.3 前端类型与 `chapterForm.ts`：新字段类型声明与表单装配；`tsc` 0 错误

## 7. 前端：两段式弹窗 + 提示词面板单卡

- [x] 7.1 AiModal 两段式：打开展示存量/粗组（`polished` 标记提示「未润色」）→「AI 润色」按钮（调 polish 端点，loading/错误重试）→ 编辑 →「生成正文」；生成完成展示 `word_check` 与 `self_check` 清单（横幅/toast，提示性质）；vitest 交互用例
- [x] 7.2 PromptManagementPage 重写为整章单卡（内容查看/编辑保存/「AI 润色」入口/状态徽标），PromptPane 壳不变；移除分段列表与生成按钮；vitest 用例
- [x] 7.3 检查 `TierGate feature="prompt-panel"` 口径不变（免费隐藏提示词子 label）；免费用户触达润色入口的路径不新增

## 8. 端到端与收口

- [x] 8.1 e2e 更新：提示词面板整章断言（替代分段列表断言）、润色→生成全链路（打桩 AI）、字数不足提示与自查清单展示、OgPane 新格子交互；本地 docker 栈全量 `playwright`（在 client/frontend 跑；唯一书名/exact 断言既有口径）
- [x] 8.2 回归核对：免费用户正文生成被拦口径不变、存量书旧章无新格子不报错、`GET /write/prompt` 既有消费方（AiModal）兼容；design-lint 通过
- [x] 8.3 收尾：`openspec validate ai-prompt-crafting --strict` 通过；更新本 tasks 勾选与变更说明
