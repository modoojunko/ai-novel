# 前端技术方案：爱小说 C 端大改版（免费基础能力 + 页面 UI&UX）

> 角色：前端技术负责人 · 2026-08-10
> 依据（本方案必须与共识一致）：`docs/prd/reviews/consensus.md`（C1–C6 全部裁决）、`docs/prd/PRD.md`、`docs/prd/ui-design.md`、`docs/prd/feature-matrix.md`、`docs/prd/user-story-map.md`、高保真 `docs/prd/pages/01–04`、现状代码 `client/frontend/src/`
> 覆盖范围：前端技术方案（页面/路由、组件选型、编辑器、状态管理、免费/PRO 两态渲染、复用/替换映射）
>
> ⚠️ **本文为 v1 初稿。六角色评审（`reviews/{pm,ui,ux,frontend,backend,architect}.md`）后的终版修订见 `development-plan.md` v2 §3（前端要点）/§6（组件选型）与 `reviews/consensus.md` N1–N17。以 v2 为准。**

---

## 0. 本次交付边界

**锁定（本次交付）——免费基础能力 + 页面 UI&UX**（与共识 §9 一致）：
- 免费基础能力：建书即写（默认落点正文工作台）、卷/章树 CRUD + 行内新建/hover 配置入口、卷/章轻量配置抽屉（摘要级）、正文编辑器（contenteditable + 1.5s 自动保存/实时字数/字号行距/专注模式）、底部状态栏 + 内嵌进度条、版本历史、归档只读闭环（编辑器只读 + 顶部提示条 + 树同步）、面包屑（仅正文工作台）、正文树「只显示有正文章节」、免费/PRO 字段按 tier 显隐（FeatureTier）、免费 tier 门控旁路（阶段 UI 不展示不拦截）、AI 面免费隐藏。
- 页面 UI&UX：正文工作台四层栏 + 两栏落地；高级配置独立视图（设定 7 项 + 大纲卷/章面板，入口按钮进入 + 返回正文）；01–04 高保真四页逐一实现并接真数据。

**范围外（本次不做，前端只占位/保留，不实现）**：AI 生成正文（流式/API/计费）、PRO 付费解锁逻辑（只留 tier 开关 + 能力清单 + 端点门控占位）、提示词面板 UI、导入导出、多端同步、免费限 1 本口径调整（待 O1）。

**前端对既有 AI 代码的处置**：既有 AI 代码路径（`ChapterEditor` 的流式写入/prompt tab/`RightToolbar`/`ContrastPreviewModal` 等）**保留不删**，本次交付的免费工作台不渲染它们；后续 PRO 迭代在 `FeatureTier` 门控下按同一套组件恢复。遵循「精准修改」原则，不做无关清理。

---

## 1. 页面与路由结构

### 1.1 目标结构：作品列表 / 工作台 / 高级配置（四态视图模型）

```
/novels                      → NovelListPage（作品列表，改版卡片 + 创建弹窗）
/novel/:id                   → NovelLayout（保留：AuthGuard + LicenseProvider + 项目数据壳）
                                └─ index → NovelWorkspace（唯一工作台，内部四态视图）
                                      ├─ workbench          （默认落点，写作恒为主界面）
                                      ├─ advanced-settings  （高级配置 · 设定）
                                      ├─ advanced-outline   （高级配置 · 大纲）
                                      └─ archives           （归档）
```

**决策：四态用「组件内部视图模型」承载，不拆子路由。** 理由：
1. 共识 C5 原文即把视图状态从 `TabId` 体系改为「`workbench | advanced-settings | advanced-outline | archives`」四态——是状态模型而非路由。
2. 视图切换不卸载 `Workbench` → 正文编辑器脏状态（未到 1.5s 防抖窗口的输入、光标位置）在「设定/大纲/归档」往返后不丢，符合「返回正文 →」的无损预期。
3. 避免清理现状 App.tsx 中一批死子路由（`/settings/*`、`/outline`、`/prompts`、`/write`、`/threads` 全部 `redirect ..`）。
4. 若未来需要深链/分享，再以 `?view=` 查询参数同步 URL，状态模型不变。

### 1.2 与现有 NovelLayout / NovelPage 的替换关系

| 现有 | 处置 | 新角色 |
| --- | --- | --- |
| `pages/NovelLayout.tsx` | 保留改造 | AuthGuard 保留；上挂 `LicenseProvider`（下发 tier）+ 项目加载壳（书名/类型等共享数据），渲染 `<Outlet/>` |
| `pages/NovelPage.tsx`（约 1100 行巨石组件） | 拆分退役 | 拆为 `NovelWorkspace`（四态视图机） + `Workbench` / `AdvancedSettingsView` / `AdvancedOutlineView` / `ArchivesView` 四个视图组件 |
| `App.tsx` 死子路由（`settings/world/outline/prompts/write/threads`） | 删除 | 收敛为 `/novel/:id` 单 index |
| `pages/NovelListPage.tsx` | 改造 | 对齐 01-list.html：卡片「继续创作 →」主按钮 + 阶段标签 + 免费限 1 提示（沿用现有 tier 判断） |

### 1.3 四层栏映射（对齐 02-writing.html，按共识修正）

| 层级 | 高保真（02-writing） | 现状 | 新方案 |
| --- | --- | --- | --- |
| 应用栏（产品级） | 爱小说 · 我的作品 · 设置 | `components/Navbar.tsx` + `ClientShell` + `Footer` | 复用，不改 |
| 小说栏（小说级） | 书名 · 类型 · [高级配置] · 免费提示 | 无（NovelPage 顶栏是阶段 tab） | **新建 `NovelBar`**（书名就地改名 + 类型 + 「高级配置（可选）：设定 / 大纲」入口 + 「归档」 + 免费/PRO 提示） |
| 面包屑栏（层级定位） | 作品 / 卷 / 章 | 无 | **新建 `Breadcrumb`**（h-9 轻量，仅正文工作台渲染，C4） |
| 正文工具条 | 字号/行距/专注/版本/归档 | `ChapterEditor` 内联 | **抽取 `EditorToolbar`** |
| 底部状态栏 | 本章字数 + 保存状态 + 进度 | `ChapterEditor` 内联 | **抽取 `BottomStatusBar`**（字数 + 保存三态 + 内嵌进度条，C6） |

> 注意：02-writing.html 是早期三栏高保真（含右侧 22% 进度卡）；共识 C6 已裁决为**两栏（左树 + 右编辑器）+ 底部进度条**，本方案按 C6 收敛，右侧进度卡不建。

---

## 2. 组件选型与新建清单

### 2.1 daisyUI 基元映射

| 基元 | 用途 |
| --- | --- |
| `btn btn-primary btn-md` | 主操作（抽屉「去写正文 →」、卷纲/章纲「保存」「确认完成」） |
| `btn btn-ghost btn-sm` | 次级（返回正文、版本历史、专注模式、归档） |
| `drawer drawer-end` | 卷/章配置抽屉（右侧滑出 w-[400px]，C3 工作台抽屉轨） |
| `modal modal-box` | 版本历史、添加卷弹窗、创建弹窗（沿用现有 `CreateProjectModal`/`DeleteConfirmModal`/`RenameModal`） |
| `progress progress-primary h-1.5` | 设定 n/7 进度（7/7 换 `progress-success`）与本章进度条 |
| `badge badge-xs` | 节点三态徽标（ghost 未填 / warning 进行中 / success 已确认）与免费「可后补」标 |
| `alert alert-warning` | 归档只读提示条、免费「高级配置 · 可选」提示 |
| `join join-horizontal` | 字号/行距分段控件（小/中/大 · 紧凑/舒适/宽松） |
| `menu` | NovelBar「高级配置」下拉（或直接放两枚入口按钮） |
| 现有 `lib/toast.tsx` | 保存成功/归档成功轻提示 |

### 2.2 新建组件清单

| # | 组件（建议路径 `src/components/novel/…`） | 职责 | 关键基元/依赖 |
| --- | --- | --- | --- |
| 1 | `license/LicenseProvider.tsx` + `useTier` | tier 单一数据源（缓存 `/auth/verify`，下发 `{tier, isFree, isPro}`） | React Context |
| 2 | `license/FeatureTier.tsx` + `lib/features.ts` | 能力清单注册表 + `<TierGate feature>` / `<TierField feature locked>` 统一消费 | useTier |
| 3 | `NovelBar.tsx` | 小说栏：书名就地改名 + 类型 + 高级配置入口 + 归档 + 免费提示 | `menu` / `btn btn-ghost btn-sm` / FeatureTier |
| 4 | `Breadcrumb.tsx` | 面包屑栏：作品 / 卷 / 章（h-9，仅工作台） | 纯 div + 分隔符 |
| 5 | `Workbench.tsx` | 两栏容器：左 `WritingTree` + 右 `ChapterEditor` 区 + `BottomStatusBar`；持有 focusMode 状态 | — |
| 6 | `WritingTree.tsx` | 包装 `StructureTree`：只显示有正文章节、卷/章 hover「配置 →」、行内新建卷/章、字数/归档徽标 | StructureTree（扩展）+ `btn btn-ghost btn-xs` |
| 7 | `VolumeConfigDrawer.tsx` / `ChapterConfigDrawer.tsx` | C3 工作台抽屉轨：卷名+卷摘要 / 章名+章摘要（免费）；PRO 追加高级字段（🔒/隐藏）；「去写正文」 | `drawer drawer-end` + 复用 VolumeEditor 保存逻辑 / OutlineEditor 摘要字段 |
| 8 | `EditorToolbar.tsx` | 字号/行距分段 + 专注模式 + 版本历史 + 归档本章 | `join join-horizontal` + `btn` |
| 9 | `BottomStatusBar.tsx` | 本章实时字数 + 保存三态（编辑中/已自动保存✓/失败重试）+ 内嵌进度条（百分比 + 目标 2200 + 字数同排，C6） | `progress` + `text-xs text-base-content/40` |
| 10 | `ArchiveBanner.tsx` | 归档只读提示条（顶部 `alert`，含「返回未归档章节可继续编辑」） | `alert alert-warning` |
| 11 | `AdvancedSettingsView.tsx` | 高级配置 · 设定：顶部「设定 n/7」进度 + 左 7 项树（三态徽标）+ 右表单 | `progress` + `badge` + 复用 `SettingsFormField` |
| 12 | `SettingsProgressBar.tsx` | 「设定 n/7」（n=7/7 变色） | `progress` |
| 13 | `SettingNodeBadge.tsx` | 未填（灰 ○）/ 进行中（琥珀 ●）/ 已确认（绿 ✓）三态 + 「可后补」标 | `badge badge-xs`（ghost/warning/success） |
| 14 | `AdvancedOutlineView.tsx` | 高级配置 · 大纲：左卷/章树 + 右上下文编辑面板（全字段）；缺字段就地提示 + 批量确认 | 复用 `useOutline` + `OutlineEditor` |
| 15 | `VolumeConfigPanel.tsx` / `ChapterConfigPanel.tsx` | 卷纲全字段（结构模板/核心冲突/情绪走向/信息差/冲突阶梯/场景卡）、章纲全字段（方向输入/key_points/情绪设计/钩子/段落拆分/目标字数） | 复用 `OutlineEditor` 内部表单 + `TabBar`/`Field`/`ListEditor` |
| 16 | `EmptyState`（改造） | 「建书即写」空态：添加卷 / 添加章；去掉设定未完成门控与「去设定」引导 | 复用现有组件，改文案 |

### 2.3 复用现有组件

| 现有组件 | 新工作台角色 |
| --- | --- |
| `StructureTree` | 树基元：扩展（见 WritingTree）行内新建 / 父节点删除 / hover 配置入口，尽量少改 |
| `ChapterEditor` | 重构保留：核心 ProseEditor（contenteditable + 自动保存 + 状态栏）保留；AI 工具条 / prompt tab / `RightToolbar` 挂 FeatureTier 隐藏（代码保留） |
| `OutlineEditor` / `OutlineOverview` | AdvancedOutlineView 章/卷面板直接复用 |
| `SettingsFormField` + 9 类设定表单（`GenreSettingForm`/`WorldSettingForm`/`StyleSettingForm`/`AntiAiSettingForm`/`HooksSettingForm`/`CharacterManager`/`ModelSettingForm`/`SynopsisCard`） | AdvancedSettingsView 直接复用；PRO 字段外包 `<TierField>` |
| `VolumeEditor` | 摘要级卷保存逻辑复用（工作台抽屉 + AdvancedOutlineView 卷面板） |
| `VersionHistory` | 工作台「版本历史」入口 → 弹层/抽屉 |
| `ArchivePage` / `ArchiveReader` | archives 视图 |
| `shared/StatusBadge` | 树/进度三态徽标基元 |
| `CreateProjectModal` / `DeleteConfirmModal` / `RenameModal` | 作品列表与树 CRUD |
| `GateBanner` / `OnboardingCard` / `TabProgressButton` | 免费态不渲染（门控旁路）；文件保留，PRO gate 恢复时复用 |

---

## 3. 正文编辑器实现

### 3.1 contenteditable 方案（plain-text 模型 + 段落序列化）

现状 `ChapterEditor` 用 `<textarea>`，prose 存 YAML 纯文本。改版目标为 contenteditable（02-writing.html / ui-design 屏5）。为避免存储格式与既有数据/归档/markdown reader/AI 流式（均按纯文本）全面翻车，采用**「纯文本模型 + contenteditable 视图」**：

- **存储/模型层不变**：prose 仍为纯文本字符串（`\n\n` 分段）。
- **载入**：`prose → 按 \n\n+ 拆段 → 每段渲染为 <p>`；段内换行拍平或转 `<br>`。章标题由 `chapter.title`（元数据）单独渲染，不混入正文 HTML。
- **编辑**：`onInput → 遍历子节点序列化段落 → \n\n 拼接 → setProse(plainText)`；字数 `countChars(plainText)`（沿用现有去空白计数）。
- **白名单**：渲染层仅允许 `p / br / strong / em`（未来富文本兜底）；存储层一律拍平为纯文本——**不存在把 HTML 写回 YAML 的问题**。
- **选择捕获**：`lib/selection.ts` 已有 `useSelectionCapture`（基于 textarea），改为基于 contenteditable 的 `document.getSelection` + Range 偏移计算，供后续 PRO「续写/润色/扩写」与「AI 生成插入」复用。
- **前端对外契约**：新增 `ProseEditor` 组件封装以上逻辑，暴露 `getPlainText() / setPlainText() / captureNow()`；`ChapterEditor` 内部替换 textarea 为此组件。

**理由（与 CLAUDE.md「简洁优先」一致）**：不动存储格式 = 后端、归档、markdown 渲染、版本快照、AI 流式全部零迁移；改动集中在编辑器视图层。

### 3.2 自动保存（1.5s 防抖）

- 防抖窗口由现状 **3000ms → 1500ms**（需求：停止输入 1.5s → 「已自动保存 ✓」）。
- 沿用 `ChapterEditor` 现有的 `saveFnRef` / dirty 快照 / 保存三态模式：
  - `isDirty` = `prose !== initialProse || summary !== initialSummary || status !== initialStatus`
  - 定时器触发 → `PUT /novels/:id/chapters/:ref` → 快照更新 → 状态置「已自动保存 ✓」（2s 后回落）
  - 失败 → 状态置「保存失败」，底部状态栏出现「重试」
- 组件卸载/切章时 flush 未落盘改动（防丢窗口）。

### 3.3 字号 / 行距 / 专注模式

- **字号**：小/中/大 = 15/17/19px；**行距**：紧凑/舒适/宽松 = 1.8/2.0/2.2；默认 17px / 2.0（ui-design §3.2）。
- 以 CSS 变量作用于 ProseEditor 容器（`--prose-size` / `--prose-leading`），不用每段内联样式。
- 偏好持久化到 `localStorage`（跨会话记忆）。
- **专注模式**：状态提升到 `Workbench` 级（非 ChapterEditor 内部）——隐藏左树 + 小说栏/面包屑，正文 `max-w-3xl mx-auto` 居中；**底部状态栏保留**（共识 C6：专注模式下底部状态栏是唯一持续可见进度锚点）；`Esc` 退出。02-writing 已实现 `focusMode` 形态，直接迁移为 Workbench 级。

### 3.4 归档后只读态

- `chapter.status === 'archived'` → ProseEditor `contentEditable=false`（或切换为只读渲染）+ 顶部 `ArchiveBanner`（📦 已归档章节 · 只读查看）+ 工具条「归档本章」禁用 + 树节点 📦 徽标同步 + 底部状态栏进度定格。
- 归档动作：工具栏「归档本章」→ confirm → `POST /chapters/:ref/archive`（沿用现有 `handleArchive`）→ 状态机 + 树刷新。
- 版本历史在只读态仍可查看（归档回滚走版本恢复，属 PRO/后续，本交付只保留查看入口）。

---

## 4. 状态管理改造

### 4.1 新增 `LicenseProvider` / `useTier`（免费/PRO 单一数据源）

现状 `tier` 在 `NovelPage` 与 `NovelListPage` 各自 `post /auth/verify` 取一次，散落不可共享。新方案：
- `LicenseProvider` 挂到 `NovelLayout`（或 App 根），组件挂载时取一次 tier 并缓存，下发 `{ tier, isFree, isPro }`。
- 供 `FeatureTier`、`NovelBar`、`Workbench`（AI 入口显隐）统一消费。

### 4.2 现有 hooks 处置

| hook | 现状 | 新工作台处置 |
| --- | --- | --- |
| `useNovelState`（phase-status + gate warnings） | 驱动阶段 tab / GateBanner | **免费态不再消费**（门控旁路：阶段 UI 不展示不拦截）；文件保留，PRO gate 恢复时复用。`fetchPhaseStatus` 改为 tier 条件触发（isFree 跳过） |
| `useOutline`（tree + chaptersMap + statuses + save/confirm） | AdvancedOutlineView 数据源 | **原样复用**；树数据切到 DB-backed `/tree`（契约见 §7），hook 内部不变 |
| `useChangeHistory`（AI 模型配置历史 `/model-history`） | settings 用 | 与工作台无耦合，保持原样，不动 |

### 4.3 新增

- **`useChapterData(projectId, chapterRef)`**：从 `ChapterEditor` 抽取的章数据 hook——载入 prose/summary/status、1.5s 防抖自动保存、保存三态、归档状态。`ChapterEditor` 与两个配置抽屉共用。
- **`useWorkbench(projectId)`**：组装 project 元信息 + 树（DB-backed）+ 当前卷/章选中态 + 四态 view + 归档同步。树与选中态跨视图（工作台 / 高级大纲）共享同一份数据，双轨（C3）都写同一 `PUT` 端点，无状态分裂。
- **四态视图切换不卸载 `Workbench`** → 编辑器脏状态/光标跨视图存活（§1.2 决策 2）。

---

## 5. 免费/PRO 两态渲染策略

### 5.1 能力清单（`lib/features.ts`）

| feature key | 免费 | PRO |
| --- | --- | --- |
| `tree-crud`（卷/章树增删改/重命名） | ✅ | ✅ |
| `prose-edit`（contenteditable + 自动保存） | ✅ | ✅ |
| `version-history` | ✅ | ✅ |
| `archive` | ✅ | ✅ |
| `volume-chapter-config`（摘要级抽屉） | ✅ | ✅ |
| `advanced-config-entry`（设定/大纲入口） | ✅ 可见可进，标注「可选」 | ✅ |
| `settings-7-items`（人工字段） | ✅（只渲染人工部分） | ✅ |
| `settings-ai-fields`（核心卖点/目标读者/语言风格/节奏偏好/基调/禁忌/爽点/题材级配置） | 🔒 隐藏或「属 PRO」 | ✅ |
| `outline-advanced-fields`（结构模板/冲突阶梯/key_points/情绪设计/钩子/段落拆分） | 🔒 | ✅ |
| `ai-generate`（AI 生成正文） | 🔒 免费不渲染按钮 | ✅ |
| `prompt-panel` | 🔒 | ✅（仅在 AI 生成面板内） |
| `ai-model` | 🔒 | ✅（独立配置，不入设定 n/7，C2） |

### 5.2 入口与字段显隐（同一套组件，按 license 态渲染）

- **设定/大纲入口（C1）**：`NovelBar` **免费与 PRO 都显示**「高级配置」入口，免费态加「高级配置 · 可选」标注；入口按钮 → 进入独立视图（`advanced-settings` / `advanced-outline`），视图内顶栏「返回正文 →」。不做顶层 tab 默认落点（C5）。
- **设定 7 项（C2）**：展示口径固定 7 项：题材 → 简介 → 世界 → 风格 → 反AI味 → 伏笔 → 角色；顶部「设定 n/7」进度（7/7 变色）；`ai-model` 不在树内、不计数。免费态进入后：7 项人工字段可编辑，PRO 字段（题材级配置、简介核心卖点、风格语言/节奏、反AI味高级规则等）折叠为「属 PRO」提示或 🔒 不可编辑（对齐 03-settings.html 的内联提示示范）。
- **AI 入口**：免费态 `Workbench` 不渲染「AI 生成正文」按钮、`AdvancedSettingsView` 不渲染 AI 填充按钮（`Field aiGeneratable` 按 tier 关闭）；PRO 态恢复。
- **统一消费**：所有显隐走 `FeatureTier` 与 `lib/features.ts`，禁止在组件里散落 `if (tier === 'none')`（C1 落地修正）。

### 5.3 门控旁路（免费态）

- 免费态：不请求/不渲染 phase-status、GateBanner、阶段 tab、设定引导卡；建书即写直达正文工作台（`Workbench` 默认落点）。`OnboardingCard` 的「先去设定」引导在免费态关闭（「建书即写」零打扰，对齐 consensus C1 落地修正）。
- 后端在免费态对 AI 端点返回 403；前端 FeatureTier 隐藏入口为双保险。
- 开放问题 O3（`current_phase` 是否随操作推进）留后端/后续，前端免费态不展示阶段。

---

## 6. 复用 / 替换映射表

| 现有组件 | 新工作台角色 | 动作 |
| --- | --- | --- |
| `pages/NovelPage.tsx` | → `NovelWorkspace` + 四视图 | 拆分退役 |
| `pages/NovelLayout.tsx` | NovelLayout | 保留 + 挂 LicenseProvider / 项目壳 |
| `components/Navbar.tsx` | 应用栏 | 复用不改 |
| `components/novel/StructureTree.tsx` | 树基元 | 复用 + 最小扩展（行内新建 / 父节点删除 / hover 配置入口），或包 `WritingTree` |
| `components/novel/ChapterEditor.tsx` | ProseEditor 核心 | 重构：text→contenteditable；AI 面挂 FeatureTier 隐藏 |
| `components/novel/outline/OutlineEditor.tsx` / `OutlineOverview.tsx` | AdvancedOutlineView 面板 | 复用 |
| `components/novel/settings/SettingsFormField.tsx` + 各 `*SettingForm` + `SynopsisCard` | AdvancedSettingsView 表单 | 复用 + 外包 `<TierField>` |
| `components/novel/VolumeEditor.tsx` | 摘要级卷保存 | 复用逻辑（抽屉/卷面板） |
| `components/novel/VersionHistory.tsx` | 版本历史 | 复用 |
| `components/novel/ArchivePage.tsx` / `ArchiveReader.tsx` | archives 视图 | 复用 |
| `components/novel/EmptyState.tsx` | 建书即写空态 | 改造文案/去门控 |
| `components/novel/GateBanner.tsx` / `OnboardingCard.tsx` / `TabProgressButton.tsx` | （免费态不渲染） | 保留文件，PRO 复用 |
| `components/novel/RightToolbar.tsx` / `PromptManagementPage.tsx` / `AiReviewStep1/2` | （AI 面） | 保留不删，FeatureTier 隐藏 |
| `hooks/useNovelState.ts` | （免费态不消费） | 保留，PRO gate 恢复复用 |
| `hooks/useOutline.ts` / `useChangeHistory.ts` | AdvancedOutlineView / settings | 复用 |
| `components/novel/settings/FormField.tsx`（`Field`/`InputField`/`ListEditor`/`TabBar`/`SaveButton`） | 设定/大纲表单基元 | 复用 |

---

## 7. 前端依赖的后端新契约（协作清单）

本交付为前端视角，以下契约是前端正常工作的依赖，需后端一并落地（共识 §9「数据底座」）：

1. `GET /novels/:id/tree` 返回卷/章树，章节元数据含 `{ ref, title, status, word_count, has_prose, archived }` —— 支撑「正文树只显示有正文章节」、字数/归档徽标、双轨树复用同一数据源。
2. 卷/章 CRUD 走 SQLite `volumes/chapters` 表（Alembic + 幂等回填）；YAML 内嵌 chapters 降级为派生数据。
3. 卷配置写 `PUT /volumes/:ref`、章配置写 `PUT /chapters/:ref/outline`（C3 双轨同一端点，无数据模型分裂）。
4. 设定展示口径 7 项 = 前端映射（genre/synopsis/world/style/anti-ai/hooks/characters），`ai-model` 独立不计数；存储 9 类 key 不动。
5. 免费态 AI 端点返回 403（后端兜底，前端 FeatureTier 隐藏双保险）。

---

## 8. 实施顺序（建议）

1. `LicenseProvider` + `FeatureTier` + `lib/features.ts`（两态地基）。
2. `NovelWorkspace` 四态视图机 + 路由收敛（删死子路由）。
3. `NovelBar` + `Breadcrumb` + `Workbench` 两栏 + `WritingTree`。
4. `ProseEditor`（contenteditable + 1.5s 自动保存 + 字号/行距/专注 + 归档只读 + `BottomStatusBar` 进度）。
5. `VolumeConfigDrawer` / `ChapterConfigDrawer`（工作台抽屉轨，摘要级）。
6. `AdvancedSettingsView`（7 项 + 设定 n/7 进度 + 三态徽标）。
7. `AdvancedOutlineView`（卷/章全字段面板，复用 `useOutline`）。
8. archives 视图接线 + `EmptyState` 文案。
9. 对齐 01–04 高保真逐页验收 + E2E 补测（免费主流程：建书即写 → 树 CRUD → 抽屉 → 写作自动保存 → 归档只读）。

---

## 9. 风险与开放问题

- **R1 contenteditable 序列化兼容**：既有 YAML prose 为纯文本，需段落序列化/反序列化兜底；建议一次性加载时做「无 HTML 则按 \n\n 包装」兼容，不做全量数据迁移。
- **R2 免费限 1 本口径（O1）**：前端已存在 `tier==='none' && novels.length>=1` 限 1（`CreateProjectModal`），与「免费=完整人工写作」定位的一致性待 owner 确认（本次不改）。
- **R3 双轨一致性**：工作台抽屉与高级大纲面板写同一 `useOutline.saveChapter` / `PUT`，需保证切换视图时脏状态不互相覆盖（建议双轨共用同一 chapterData 缓存）。
- **R4 专注模式状态提升粒度**：提升到 `Workbench` 级后需保证「退出专注」与「Esc」在编辑器失焦态也可用。
- **R5 设定 6/7 进度 bug（O5）**：随 7 项收敛一并修复，需一条可验证验收（画 7 项、JS 按 7 计算、显示 n/7）。
- **R6 题材级配置免费可见性（O6）**：共识 C1 判题材配置为 PRO 字段，但 user-story-map 将其描述为「可后补、可覆盖」普通配置；需确认题材配置区对免费是否部分可填（人工约束），影响 `AdvancedSettingsView` 题材表单的 TierField 边界。
