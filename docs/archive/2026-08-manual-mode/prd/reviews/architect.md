# 架构师评审：爱小说 C 端大改版（PRD v1.0）

> 角色：总架构师（engineering-architect，评审裁决优先级最高）
> 日期：2026-08-10
> 范围：PRD.md / feature-matrix.md / user-story-map.md / ui-design.md / backend-design.md / manual-mode-review.md / pages/01-04 / prototype.html
> 聚焦：非 AI 参与的基础能力 + 页面 UI&UX 设计；免费/PRO 两态 UI 边界
> 结论类型：架构方向裁决 + C1–C6 逐条裁决 + 差距/风险 + 分期建议 + 免费基础能力状态清单

---

## 1 总体结论

**PRD 的「正文工作台 = 唯一主界面、免费 = 建书即写」范式与现有六阶段工作流（init→settings→outline→prompt→write→archive）存在真冲突，但冲突只发生在「流程闸门 + UI 导航」层，不在数据层，可控且必须在改版第一刀就解决。**

### 1.1 冲突定位（为什么说「数据层不冲突」）

六阶段映射的存储桶全部是既有结构：settings KV 表（9 类 key）、volumes YAML、chapters YAML（outline/memo/emotional_design/segments/prose）、prompts 文件、versions 快照、archives。免费人工写作只需 `volumes / chapters(prose) / versions / archives` 四个桶；settings/outline/prompt 桶存在即可、免费用户可以不碰。**存储上没有任何需要推倒的东西。**

冲突集中在三处既有代码行为：
1. **新书默认落点 settings**：`NovelPage` 的 `useEffect` 把 `isNew` 项目强制切到设定 tab——这是「流程绑架」的直接来源。
2. **write 被 gate 闸在 prompt 之后**：`gate_prompts_exist` 是 hard gate（outline→prompt、prompt→write 必须先生成提示词文件）；`gate_chapter_ready` 硬要求 memo/emotional_design/segments 填满。免费手写用户根本不需要这些。
3. **阶段引导 UI 噪音**：`TabProgressButton`（六阶段状态）、`GateBanner`、`EmptyState`（设定未完成催促）都是为线性阶段进度设计的，免费用户进入会看到「设定未完成/提示词未生成」的无关警告。

### 1.2 架构方向（三项主裁决）

**A. 数据：采纳 backend-design.md 并强化「唯一属主」边界。**
- 设定 9 类 key 继续存 DB KV（现状，不动）；卷/章**结构元数据**（卷序/章序/标题/摘要/状态/字数/章纲完成度）新增 `volumes`/`chapters` 表入 SQLite，列表/树/字数/进度/归档状态改走 DB，不再文件扫描。
- **正文、章纲、提示词、版本快照继续 YAML，不进表**（backend-design §2.2 对 chapter_outlines「保留 YAML，DB 只存 outline_status」的判断正确，采纳）。
- 卷 YAML 内嵌的 `chapters` 列表从「唯一属主」降级为**派生数据**：回填完成后写路径不再维护它，读取可选由 DB 重建——消灭双写漂移。双写策略：内容 YAML 先写、DB 元数据后更，失败可补偿，**以 YAML 为内容准、以 DB 为结构准**。

**B. 流程：六阶段保留为「PRO/AI 上下文」概念，新增 tier 感知的门控旁路层。**
- 免费模式：全部 phase gate 视为通过（不展示、不拦截、不催促），`current_phase` 不再驱动 UI 导航。
- PRO 模式：现有 gate 全部生效（AI 生成需要 settings 作上下文、需要 outline 组提示词）。
- 解耦原则：**UI 由用户所在视图驱动（正文工作台为主），阶段完成度只是 PRO 的进度信号**。这条把 PRD 范式与现有阶段机的矛盾一举消解，且不破坏六阶段数据模型与既有 PRO 流程。

**C. 两态：同一套 UI 结构 + 一份 tier 能力清单（capability map）。**
- 免费/PRO 不搞两套页面。差异收敛为：入口可见性（🔒/隐藏/可用）、AI 字段显隐、提示词入口存在与否。前端用一个 `FeatureTier` 能力清单组件统一消费，后端对 PRO-only 端点做 tier 校验（免费直呼 AI 端点返回 403），防止「只藏入口不锁 API」。

### 1.3 分期总览

| 期 | 内容 | 理由 |
| --- | --- | --- |
| P0 | 免费基础能力：tier 旁路 + 默认落点正文 + 免费字段显隐 | 先交付「建书即写」核心价值，不依赖 UI 大改 |
| P1 | 卷/章元数据入 DB + 幂等回填 | 树/进度/归档的查询底座，UI 改版的前提 |
| P2 | UI&UX 改版：正文工作台收敛 + 高保真四页落地 | 表现层收敛，依赖 P0/P1 的 tier 与元数据就位 |
| P3 | PRO 解锁逻辑（范围外） | 只留 tier 开关、能力清单与端点门控占位 |

---

## 2 优点

1. **定位正确且锋利**：「免费 = 完整人工写作能力；PRO = 同一界面解锁 AI」（PRD §1.1）直击小禾（怕复杂）与老赵（恨流程绑架）两个画像；设定/大纲降级为可选项 + 正文工作台唯一主界面，是「10 秒建书、今天写正文」的产品化落地。
2. **「一套 UI，两种状态」原则对**（feature-matrix §3 / ui-design §1.1）：付费差异收敛到入口可见性与字段显隐，避免双代码路径——这正是大改版最该守住的红线，本评审所有裁决都围绕它展开。
3. **后端方向完全认同**（backend-design.md）：元数据入 SQLite、正文/章纲留 YAML、不做章纲迁库、六阶段就绪度实时计算不落库（避免状态漂移）——与现有 composite_storage（ADR-001/002）一脉相承，最小侵入，风险可算。
4. **信息去重与状态语言是好的设计纪律**（PRD §6 / ui-design §3.1）：层级/归档/字数/进度/入口各有唯一位置；「未填/进行中/已确认」+ 保存三态与现有 TabProgressButton / OutlineEditor 状态机兼容，前端可复用。
5. **提示词重定位干净**（manual-mode-review）：提示词 = AI 生成能力的内部环节而非创作流程一步，UI 只收敛到「AI 生成正文」面板——手动用户零打扰，架构上彻底解耦。
6. **现状复用度高**：自动保存（ChapterEditor 3s debounce）、实时字数、版本历史（VersionHistory）、归档只读（ArchivePage/ArchiveReader）、tier 概念（auth.verify 返回 tier + NovelListPage 免费限 1 本）都已具备；高保真四页（01–04）质量高且与 daisyUI 暖色体系一致，是可直接执行的蓝本。

---

## 3 C1–C6 逐条裁决

### C1 设定入口免费用户可见性 —— 立场：**可见但折叠，标注「高级配置 · 可选」；免费只显示人工字段，PRO 字段隐藏/🔒**

裁决「免费完全不显示设定入口」（PRD §2/§5.1/§8 验收#5）为**过度收紧**，采 feature-matrix §6(b) 与 ui-design §1.1 的推荐（可见可进、标注可选）。

理由：
1. **PRD 自身在途交互已矛盾**：§4.1 小说栏画了 `[设定(PRO)]` 占位；§3.1 免费主流程又含「点卷节点→抽屉填卷摘要」（一种配置入口）。「隐藏设定入口」与 PRD 自身的树/抽屉交互冲突。
2. **伏笔/角色/世界是纯人工能力**：免费 = 完整人工写作（§1.1）理应包括它们。把可人工填写的创作内容藏起来 = 人为砍掉免费能力，违背定位，也堵死后续 PRO 转化锚点。
3. **消失的入口不教育用户**：一个「不显示」的入口比「标注可选」的入口更糟——需要设定帮助的老手找不到入口，新书引导也无从谈起。
4. **全隐藏 = 设定功能对免费成死代码**：9 类 key 存储 + 确认/进度 UI 全白维护，两态差异被放大，违背「两态体验几乎一致」。

落地修正（需同步修订 PRD）：
- 正文工作台**默认不设设定 tab、不弹设定引导**——保证「建书即写」零打扰（保留 02-writing.html 的免费主界面无设定 tab 形态）。
- 设定/大纲作为小说栏/工作台的**次级「高级配置」折叠入口**存在，免费可见可进。
- 免费进入后只渲染免费字段；PRO 专属字段（核心卖点/目标读者/语言风格/节奏偏好/基调/禁忌/爽点/题材级配置）显示 🔒 或隐藏（03-settings.html 各面板的「免费模式：…属 PRO」内联提示即是正确示范）。
- 修订 PRD §5.1「不显示设定入口」→「设定入口折叠于高级配置，标注可选」；§8 验收#5「全程不出现设定入口与任何 AI 字段」→「全程不出现任何 AI 字段与提示词入口；设定/大纲仅以折叠高级配置形式可达」。

### C2 设定项数 —— 立场：**统一为 7 项（题材、简介、世界、风格、反AI味、伏笔、角色），进度「设定 n/7」**

裁决 PRD §5.4「6 项」为**笔误/过时**；以 user-story-map / ui-design / prototype 的 7 项为准，并修 03-settings.html 的 6/7 矛盾。

理由：
1. **现状后端 READINESS 恰为 7 项 checker**（readiness.py：synopsis/genre/world/style/anti-ai/hooks/characters）——统一 7 项 = 后端零改动，确认/进度/门控全部直接复用。
2. **反AI味不是纯 AI 字段**：禁用词/套路表达/句子模式约束是人工写作也需要的防 AI 腔约束，免费（在 C1 可见设定前提下）也应能写。PRD §5.4 漏掉它是因为把它当成了 AI 专属字段，判断过时。
3. **高保真内部已自相矛盾**：03-settings.html 画 6 项但 JS 进度写 `n/7`（原型 bug）；prototype 与 ui-design 画 7 项。以 7 项收敛，把 03-settings.html 改为 7 项并修进度 bug。

补充：`ai-model`（AI 模型配置）**不入 n/7**，作为独立「配置」项，不参与创作进度；`status`/`story` 为内部/衍生键不展示。存储仍 9 类 key 不动，n/7 只是展示层口径。

### C3 大纲视图形态 —— 立场：**双轨——正文工作台内点树节点=轻量抽屉（卷名+摘要 / 章名+摘要 + 去写正文）；大纲独立高级配置视图=左侧树 + 右侧上下文编辑面板（全字段）**

理由：
1. **两者服务不同路径，可并存**：抽屉是免费模式「最快到正文」的内联快捷配置（PRD §3.1 免费主流程，§4.3「配置抽屉」），独立面板是高级配置的完整编辑面（ui-design 屏3 / 04-outline / prototype）。数据写同一 PUT 端点（`PUT /volumes/{ref}`、`PUT /chapters/{ref}/outline`），无数据模型分裂。
2. **若被迫二选一，独立面板更可扩展**（全字段 + 批量确认 + 缺字段就地提示），但抽屉胜在「去写正文」一步到位。免费主流程保留抽屉、高级配置用面板，兼得两者。
3. 裁决「PRD §4.3 抽屉」为免费层机制、「ui-design 屏3 面板」为高级配置层机制，二者以「当前视图上下文」区分：同一 `handleSelect`，在正文工作台上下文弹抽屉、在大纲视图上下文刷右面板，杜绝两套编辑状态。

### C4 面包屑栏 —— 立场：**保留，但只存在于正文工作台；设定/大纲视图以左树为层级定位，不重复面包屑**

理由：
1. 正文工作台在**专注模式/树收起**时，面包屑是唯一层级锚点；PRD §6「层级唯一位置在面包屑」的意图正确。
2. 02-writing.html（免费主界面最终高保真）已实现面包屑栏；prototype 的「书名·章名合一顶栏」是原型取巧，非定稿。
3. 去重原则（§6）本意是「同一视图内层级不出现两处」：正文工作台用面包屑，设定/大纲视图的层级本就在左树，再放面包屑反而重复——故限定范围。

落地：新增轻量面包屑组件（作品 / 卷 / 章，h-9），仅写正文工作台；高级配置视图不渲染。

### C5 高级配置入口形态 —— 立场：**正文工作台 = 唯一主界面，写作恒为默认落点；设定/大纲从工作台「高级配置」入口按钮进入独立视图（非顶层 tab 默认落点），视图内提供「返回正文」**

理由：
1. **完全采纳 feature-matrix §6 推荐项**（「顶部 tab 降级为入口按钮 + 面板展开」），与 PRD「正文工作台唯一主界面」一致。
2. **现状是 tab 体系且新书默认落点 settings**（NovelPage TABS：设定/卷纲/章纲/提示词/正文/归档）——与新范式直接冲突，需重构为「正文（默认）+ 高级配置入口（设定/大纲）+ 归档」；**提示词 tab 移除**（提示词只在 AI 生成面板内出现，manual-mode-review 已定）。
3. 高保真收敛：以 02-writing.html 为正文主界面蓝本，叠加 prototype 的「高级配置（可选）：设定 / 大纲」次级入口条。

落地：视图状态从 `TabId` 体系改为「`workbench` | `advanced-settings` | `advanced-outline` | `archives`」四态 + 各自 panel 子状态，默认落点 `workbench`（正文）。小说栏按 C1 放「设定(PRO)」入口按钮（免费可进/🔒标注），视图内「返回正文」。

### C6 三栏 vs 两栏 —— 立场：**两栏（大纲树 + 正文），“本章进度”降级为底部状态栏内嵌进度条（百分比 + 目标字数 + 实时字数同排），不设常驻右栏**

理由：
1. **1280×800 基准下常驻 240px 右栏大幅挤压正文编辑区**——编辑器才是主战场，PRD §4.2 三栏是理想化、代价过高。
2. PRD §6 已把「实时字数 + 保存状态」唯一位置定在底部状态栏；进度并入同一处 → **信息聚合最彻底**；专注模式（隐藏左右栏）下底部状态栏是唯一持续可见的进度锚点。
3. ui-design 屏5 与 prototype 均已两栏化；02-writing.html 的三栏（含右侧 22% 进度卡）是早期高保真，需按 ui-design 屏5 收敛。

落地：扩展现有 ChapterEditor 底部状态栏，加入进度条（当前字数 / 目标 2200 的百分比 + 「目标 xx 字」），右栏移除。

---

## 4 差距与风险

### 4.1 后端 / 数据差距

| 编号 | 差距 | 现状 | 对策 / 风险点 |
| --- | --- | --- | --- |
| G1 | 卷/章**元数据无 DB** | list_volumes 靠文件扫描；vol-N.yaml 内嵌 chapters 列表；无 word_count/status/outline_status 列 | 采纳 backend-design：新增 volumes/chapters 表 + Alembic + **幂等回填**（run-once 标记）。**最大风险=双写漂移**：YAML 内嵌 chapters 列表与 DB 重复 → 唯一属主（结构=DB、内容=YAML），写路径不再维护 YAML 内嵌列表，读取可选由 DB 重建 |
| G2 | **六阶段 gate 与免费范式冲突**（最大行为风险） | create 后默认 settings；write 被 `gate_prompts_exist`（hard）/`gate_chapter_ready`（hard）拦；TabProgressButton/GateBanner/EmptyState 催促阶段 | tier 感知旁路层：free = 全闸门通过 + 阶段 UI 不展示；pro = 现状。**需后端 workflow 路由 + 前端视图同步开关**，重点排查 create_volume 的 `gate_settings_complete`、OutlineOverview 的 transitionToPrompt 硬闸、新书默认落点 |
| G3 | 免费仍可触达 AI 面 | PromptManagementPage / RightToolbar（AI 续写/润色/扩写）/ AiReview / 导入回填流程免费可见 | 前端隐藏 + **后端端点级 tier 校验**（免费直呼 AI 端点返回 403），防「只藏入口不锁 API」 |
| G4 | 新书默认落点 settings | NovelPage `useEffect` 将 isNew 切到 settings | 改默认落点正文工作台（P0） |
| G5 | 9 类设定 vs 6/7 项展示口径 | 存储 9 类 key 与展示口径脱节 | 存储不动，展示层收敛 7 项（C2），ai-model 移出创作进度 |

### 4.2 前端差距（详见 §6 清单）

抽屉组件缺失、正文树「只显示有正文的章节」过滤缺失、面包屑缺失、底部进度条缺失、树行内 CRUD（行内新建章/删除/重命名/hover 配置入口）需强化、归档后「编辑器只读 + 顶部提示条 + 树/进度卡同步」需在正文工作台内闭环、免费字段/PRO 字段按 tier 显隐（🔒）。

### 4.3 文档与产品风险

| 编号 | 风险 | 说明 |
| --- | --- | --- |
| R1 | **PRD 内部多处矛盾** | §2/§4.1/§5.1/§5.4/§8 与 feature-matrix §3/§6b、ui-design 屏2/屏2.5/屏3/屏5、03-settings、04-outline、prototype 互相打架。开发若拿不同文档会做出不一致实现 → 按本评审 C1–C6 收敛一份 PRD v1.1 |
| R2 | **免费限 1 本未经评审** | 01-list.html「免费用户可创建 1 本小说」+ NovelListPage 已有 `tier==='none'` 限 1，但 PRD/feature-matrix 任何章节未提及。需确认口径（限 1 vs 不限），避免与免费「完整人工写作」定位冲突 |
| R3 | 03-settings.html 进度 bug | 画 6 项但 JS 写 `n/7`，且确认函数按 6 个数组元素计算——原型缺陷，收敛 7 项时一并修复 |

---

## 5 建议（分期计划）

### P0 免费基础能力先行（不依赖 UI 大改，1–2 周）
1. **tier 感知门控旁路层**：后端 workflow（free = 全闸门通过、阶段状态不落屏）+ 前端视图（新书默认落点正文工作台、TabProgressButton/GateBanner/EmptyState 阶段催促按 tier 隐藏）+ AI 面（PromptManagementPage/RightToolbar/AiReview）免费隐藏/禁用 + 关键 AI 端点 403 校验。
2. **免费主流程闭环验证**：建书 → 树 CRUD → 抽屉摘要 → 写正文自动保存 → 字数 → 归档只读 → 返回树/进度同步。验收对齐修订版 PRD §8。
3. **收敛 C1–C6 到 PRD v1.1**，修 03-settings.html 6/7 矛盾与进度 bug，确认 R2「免费限 1 本」口径。

### P1 卷/章元数据入 DB（1–2 周）
4. volumes/chapters 表 + Alembic 迁移 + 幂等回填；列表/树/统计查询改 DB；YAML 内容唯一属主不变；双写补偿（YAML 先写、DB 后更，失败重试）。
5. 正文树「只显示有正文章节」过滤、字数/归档/进度状态从 DB 元数据取。

### P2 UI&UX 改版（2–3 周）
6. 正文工作台四层栏落地（应用栏 / 小说栏 / 面包屑 / 两栏 body + 底部状态栏进度条）；树行内 CRUD 强化；卷/章轻量抽屉；归档只读闭环。
7. 高级配置独立视图（设定 7 项 + 大纲卷/章面板）从入口进入，免费字段 / PRO 字段按 tier 显隐（🔒）。
8. 01–04 高保真四页逐一对应开发并接真数据。

### P3 PRO 解锁（范围外，留接口）
9. AI 生成正文 / 提示词面板 / AI 字段的 PRO 解锁逻辑 + 计费；本次只做 tier 开关、能力清单与端点门控占位。

**排序理由**：P0 先交付「建书即写」核心价值（不依赖 UI 大改即可上线）；P1 是树/进度/归档的查询底座（无它，UI 改版会再次卡在文件扫描）；P2 是纯表现层收敛（依赖 P0/P1 的 tier 与元数据就位）；P3 留接口即可，不与本次范围耦合。

---

## 6 免费模式基础能力的实现状态清单

| 能力（免费） | 状态 | 说明 |
| --- | --- | --- |
| 创建小说（只填书名） | 需改版 | CreateProjectModal 已具备；创建后需默认落点**正文工作台**（现状落点 settings） |
| 卷/章树展示 + 选择 | 已具备 | StructureTree（卷→章 + 选中/展开） |
| 卷/章增删改/重命名（后端路由） | 已具备 | chapters/router 全 CRUD；`总卷/章数` 计数冗余在 projects 表 |
| 树行内 CRUD（行内新建章/删除/重命名/hover 配置入口） | 需改版 | StructureTree 有 actions/onDelete 底座，但「行内新建章 + hover 配置 →」交互需按 02-writing 强化 |
| 正文编辑器 + 自动保存 | 已具备 | ChapterEditor（3s debounce 自动保存 + 状态三态） |
| 实时字数 | 已具备 | ChapterEditor 字数实时刷新 |
| 底部状态栏（字数 + 保存状态） | 已具备 | ChapterEditor 底部；需**扩展进度条**（百分比 + 目标字数，C6）→ 需改版 |
| 版本历史 / 恢复 | 已具备 | VersionHistory + versions 快照 |
| 归档（只读查看） | 需改版 | ArchivePage/ArchiveReader + archived status 已具备；「编辑器内只读 + 顶部提示条 + 树/进度卡同步」需在正文工作台闭环 |
| 专注模式 / 字号行距 | 需改版 | ChapterEditor 已有排版控件；按 ui-design 屏5 规格（15/17/19px、行距 1.8/2.0/2.2、max-w-3xl、Esc 退出）对齐 |
| 卷/章配置抽屉（卷名+摘要 / 章名+摘要 + 去写正文） | 需新建 | 现状 VolumeEditor/ChapterEditor 是整页面板，无抽屉交互（02-writing 蓝本） |
| 面包屑栏（作品/卷/章） | 需新建 | C4 裁决：仅正文工作台 |
| 正文树「只显示有正文的章节」 | 需新建 | 需 chapter.prose 非空过滤 + 归档态标记 |
| 免费字段 / PRO 字段按 tier 显隐（🔒） | 需新建 | FeatureTier 能力清单组件（C1/C5） |
| 高级配置独立视图（设定/大纲入口 → 视图 → 返回正文） | 需新建 | C3/C5 裁决 |
| 设定 9 类 KV 存储 + 确认/进度 | 需改版 | 后端已具备（settings/status + readiness 7 项 checker）；前端展示口径收敛为 7 项（C2），ai-model 移出进度 |
| 免费 tier 概念 + 免费限 1 本 | 已具备 | auth.verify 返回 tier + NovelListPage 限 1（口径待 R2 确认） |
| 六阶段 gate / phase 阶段 UI | 需改版 | 按 tier 旁路：free 不展示 TabProgressButton 阶段状态 / GateBanner / EmptyState 设定催促（G2） |
| AI 面（提示词/AI 按钮/续写润色）免费隐藏 + 端点 403 | 需改版 | PromptManagementPage / RightToolbar / AiReview 免费禁用；后端端点 tier 校验（G3） |
| 卷/章元数据查 DB（列表/树/统计） | 需新建 | P1：volumes/chapters 表 + 幂等回填（G1） |

---

## 附录：关键代码定位（现状基线）

- 六阶段门控：`client/backend/workflow/gates.py`（`PHASE_ORDER`、`gate_prompts_exist`/`gate_chapter_ready` 硬闸、`get_phase_status`）；`client/backend/workflow/engine.py`（`ALLOWED_TRANSITIONS`、`update_phase`）
- 设定 KV：`client/backend/models/project_setting.py`（root_path+key 复合主键）；`client/backend/filesystem/paths.py`（9 类 PATH_TO_KEY 路由）；`client/backend/filesystem/composite_storage.py`（唯一属主非镜像）
- 设定就绪判定：`client/backend/settings/status.py`（VALID_TYPES = READINESS_KEYS ∪ {ai-model}）；`client/backend/workflow/readiness.py`（7 项 checker）
- 卷/章文件结构：`client/backend/chapters/router.py`（list_volumes 文件扫描；vol-N.yaml 内嵌 chapters）
- 前端主界面：`client/frontend/src/pages/NovelPage.tsx`（TABS 六 tab、isNew→settings 默认落点、StructureTree 左树 + renderContent 右面板、GateBanner/OnboardingCard）；`StructureTree.tsx`（actions/onDelete/hover 底座）；`ChapterEditor.tsx`（自动保存/字数/归档只读）
- tier 基础：`client/frontend/src/pages/NovelListPage.tsx`（tier==='none' 限 1 本）
