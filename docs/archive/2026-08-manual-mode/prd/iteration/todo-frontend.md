# C 端改版 · 前端任务拆分（FE-01 ~ FE-35）

> 依据：`docs/prd/development-plan.md`（v2 执行基准）§3/§6/§7 + `docs/prd/tech-frontend.md`（v2 修订） + `docs/prd/reviews/consensus.md`（N1–N17 / B1–B10 / O1/O6）。
> 粒度：组件/模块级，可排入迭代。优先级对齐分期 P0（决策收敛+免费基础）→ P1（数据底座+breaking change）→ P2（UI&UX 改版）→ P3（PRO 占位）。
> 文件根：`client/frontend/src/`（除 e2e 用例标注外）。

---

## 0. 依赖 / 复用 / 替换总览

### 0.1 现有组件处置速查（对照 tech-frontend §1.2 / §6）

| 现有组件/模块 | 处置 | 新角色 | 相关 FE |
| --- | --- | --- | --- |
| `pages/NovelPage.tsx`（≈1077 行巨石） | **拆分退役** | → `NovelWorkspace` + Workbench/AdvancedSettingsView/AdvancedOutlineView/ArchivesView | FE-05 |
| `pages/NovelLayout.tsx`（空壳） | 改造 | AuthGuard + `LicenseProvider` + 项目壳 | FE-04 |
| `App.tsx` 死子路由（settings/…/threads） | 删除 | 收敛为 `/novel/:id` 单 index | FE-06 |
| `components/novel/StructureTree.tsx` | 复用 + 最小扩展 | 树基元（editable/onDelete/actions 已具备，补行内新建插槽） | FE-11 |
| `components/novel/ChapterEditor.tsx` | 重构保留 | 拆 `useChapterData` + textarea（P0）/ `ProseEditor`（P2）；AI 面 FeatureTier 隐藏 | FE-12/13/14/15 |
| `components/novel/outline/OutlineEditor.tsx` | 改造 | 章面板（去 onBack/全页壳）→ `ChapterConfigPanel` | FE-25 |
| `components/novel/outline/OutlineOverview.tsx` | **不消费** | 保留文件，新视图默认不用 | FE-23 |
| `components/novel/VolumeEditor.tsx` | 复用保存逻辑 | 抽屉/卷面板 `PUT /volumes/{filename}` | FE-18/24 |
| `components/novel/SettingsFormField.tsx` | 改造 | 设定表单（7 项重映射 + synopsis 防重） | FE-20/22 |
| `components/novel/EmptyState.tsx` | 改造 | 建书即写空态（去设定门控） | FE-27 |
| `components/novel/GateBanner/OnboardingCard/TabProgressButton` | 保留 | 收进 PRO 容器，免费不渲染 | FE-05 |
| `components/novel/RightToolbar/PromptManagementPage/AiReviewStep1/2/ContrastPreviewModal` | 保留不删 | AI 面，FeatureTier 隐藏 | FE-12/34 |
| `components/shared/StatusBadge.tsx` | 不动 | 该组件是 API 配置态徽标，与树/进度三态徽标无关；三态徽标新抽 | FE-21 |
| `hooks/useNovelState.ts` | 保留 | 免费态不消费（PRO 容器内部触发 `fetchPhaseStatus`） | FE-05 |
| `hooks/useOutline.ts` | 复用 + 改造 | 树数据源切 `/volumes` 全量树 + `VolumeEntry` 扩 `has_prose/archived` | FE-28 |
| `hooks/useChangeHistory.ts` | 不动 | settings 自用 | — |
| `lib/selection.ts`（textarea 版） | 保留 | 与新 `lib/selectionContentEditable.ts` 并存 | FE-14 |
| `lib/api.ts` / `lib/toast.tsx` | 复用 | 数据/轻提示层 | 各 FE |

### 0.2 关键实现顺序（与 development-plan §3.5 对齐）

```
FE-01→04 两态地基 → FE-05→07 工作台骨架 → FE-08→13 免费主流程纵切（P0 可验收）
→ FE-14→17 ProseEditor → FE-18/19 抽屉 → FE-20→22 高级配置·设定
→ FE-23→25 高级配置·大纲 → FE-26/27 archives+EmptyState
→ FE-28/29 数据契约联调 → FE-30 token 化 → FE-31→33 验收+E2E → FE-34 PRO 占位
```

> 断点 1（P0 纵切验收）：FE-13 完成后即满足「建书即写→树 CRUD→抽屉→自动保存→归档只读」闭环（N1 显式验收），后端 `tier 旁路`（P0-2/3）需同步就位。
> 断点 2（P2 验收）：FE-30 完成后即满足「contenteditable 无游标跳/IME 无损 + 状态语言四态 + token 双主题」。

---

## M0 — 两态地基（P0-4，无后端耦合）

### FE-01 `LicenseProvider` + `useTier`（tier 单一数据源）
- 类型：**新建**（`components/novel/license/`）
- 说明：现状 `tier` 在 `NovelPage` 与 `NovelListPage` 各自 `post /auth/verify` 取一次（NovelPage.tsx L121–125、NovelListPage.tsx L69–72），散落不可共享。新建 `LicenseProvider` 挂 `NovelLayout`，挂载时取一次并缓存。
- 怎么做：
  - `components/novel/license/LicenseProvider.tsx`：React Context，`api.post("/auth/verify")` → 下发 `{ tier, isFree, isPro, trialRemainingDays, loading, error, refetch }`；缓存到 module 级变量避免重复请求；失败降级 `tier="none"`（免费兜底，不发 500）。
  - `hooks/useTier.ts`（或同文件导出）：`useContext(LicenseContext)`，未包 Provider 时返回安全默认值。
- 验收标准：`NovelLayout` 包裹后任意后代 `useTier()` 可取到 `{tier,isFree,isPro}`；网络仅 1 次 `/auth/verify`；`tsc --noEmit` 通过。
- 涉及文件：`src/components/novel/license/LicenseProvider.tsx`（新）、`src/hooks/useTier.ts`（新）
- 依赖：— ｜ 估算：**M** ｜ 复用：提取 NovelPage/NovelListPage 现有 `/auth/verify` 逻辑

### FE-02 `lib/features.ts` 能力清单
- 类型：**新建**（`lib/`）
- 说明：统一能力注册表，只管功能显隐（N14/C1「禁止散落 `if(tier==='none')`」）。免费限 1 本 / 试用横幅等运营判定**不**进清单，保留直判（development-plan §3.3）。
- 怎么做：
  - 定义 `FeatureKey` 联合类型与 `FEATURES: Record<FeatureKey, { free: boolean }>`。
  - 免费 ✅：`tree-crud` / `prose-edit` / `version-history` / `archive` / `volume-chapter-config` / `advanced-config-entry` / `settings-7-items`。
  - 免费 🔒（隐藏或「属 PRO」）：`settings-ai-fields`（核心卖点/目标读者/语言风格/节奏偏好/基调/禁忌/爽点；**题材级配置按 O6 免费可填、AI 消费归 PRO**）/ `outline-advanced-fields` / `ai-generate` / `prompt-panel` / `ai-model`。
  - 导出 `isFeatureEnabled(key, tier)` 纯函数（供 useTier 组合）。
- 验收标准：`isFeatureEnabled` 对上述 12 键在 `none`/`pro` 两态返回值与共识 §5.1 完全一致；纯 TS 无 DOM 依赖。
- 涉及文件：`src/lib/features.ts`（新）
- 依赖：FE-01 ｜ 估算：**S** ｜ 复用：—

### FE-03 `FeatureTier`（`<TierGate>` / `<TierField>`）
- 类型：**新建**（`components/novel/license/`）
- 说明：统一消费 `lib/features.ts` + `useTier`，两态渲染一套组件。
- 怎么做：
  - `<TierGate feature>`：`!isFeatureEnabled` → 不渲染 children（用于入口/按钮/AI 子树整体隐藏）。
  - `<TierField feature locked>`：🔒 包装表单字段（locked 态显示锁 UI +「属 PRO」提示，保留字段骨架）；O6 题材级配置字段 free 不 locked。
- 验收标准：`<TierGate feature="ai-generate">` 在 free 不渲染、pro 渲染；`<TierField feature="settings-ai-fields">` 在 free 显示锁标且输入禁用；无 `if(tier)` 散落。
- 涉及文件：`src/components/novel/license/FeatureTier.tsx`（新）
- 依赖：FE-01、FE-02 ｜ 估算：**S** ｜ 复用：—

### FE-04 `NovelLayout` 挂 `LicenseProvider` + 项目壳
- 类型：**改造**（B7：现状是空壳，项目壳 + LicenseProvider 全新建）
- 说明：保留 AuthGuard，上挂 LicenseProvider；新增项目加载壳（书名/类型/genre 共享数据）。
- 怎么做：
  - `pages/NovelLayout.tsx`：`<AuthGuard><LicenseProvider><ProjectShell><Outlet/></ProjectShell></LicenseProvider></AuthGuard>`。
  - 项目壳 = 新 `hooks/useProject(projectId)` 或 Context：`api.get(/novels/{id})` → 下发 `{project}`；供 `useWorkbench`/`NovelBar` 消费（避免 NovelPage 各自 `setProject`）。
  - 类型位数据源：`novel_to_dict` 后端补 `type/genre` 前，前端从 genre 设定派生或先留空（development-plan §4.3 #1–3）。
- 验收标准：`/novel/:id` 页面任意后代可取 `project`；`useTier()` 可用；加载骨架复用 NovelPage 现有 skeleton 区块。
- 涉及文件：`src/pages/NovelLayout.tsx`（改造）、`src/hooks/useProject.ts`（新）
- 依赖：FE-01 ｜ 估算：**M** ｜ 复用：NovelPage 的 project fetch（L243–255）

---

## M1 — 工作台骨架（P0-5/P0-7 第一步）

### FE-05 `NovelWorkspace` 四态视图机 + PRO 容器
- 类型：**新建**（替换退役 `NovelPage`）
- 说明：唯一工作台，内部四态 `workbench | advanced-settings | advanced-outline | archives`。**Workbench 常驻挂载**，切视图 `hidden` 隐藏（保 prose 脏状态/光标）；advanced/archives 首次访问懒挂载、离开卸载（FE P1-1）。默认落点 `workbench`（写作恒为主界面，C5/P0-5）。**PRO 容器（N14）**：`TabProgressButton/GateBanner/OnboardingCard/useNovelState` 收进 PRO 容器，免费态顶层不渲染该子树（杜绝 hook 条件调用）。
- 怎么做：
  - `components/novel/NovelWorkspace.tsx`：持 `useWorkbench` 的 `view` 状态 + `setView(view, payload)`（含抽屉→面板定位 payload，供 N16）。
  - PRO 容器组件：`components/novel/ProContainer.tsx`（新，内部 `useTier().isFree ? null : <>{children}</>`），`useNovelState` 仅在 ProContainer 内部调用 → 天然满足「免费不消费」。
  - 视图壳：`hidden` class 切换 + `display:none` 保留挂载；advanced/archives 用 `lazy` + 首次访问后 keep（离开 `hidden` 卸载）。
  - 拆分：NovelPage 的 TABS/顶栏/phase-status/onboarding/AI review flow 分支按新壳重写；`DeleteConfirmModal` 保留在 NovelWorkspace 层。
- 验收标准：切到 settings/outline/archives 再返回正文，未到 1.5s 窗口的输入与光标不丢；免费态无 phase-status 请求、无 GateBanner/OnboardingCard 渲染、无阶段 tab；新书默认达 workbench。
- 涉及文件：`src/components/novel/NovelWorkspace.tsx`（新）、`src/components/novel/ProContainer.tsx`（新）、`src/pages/NovelPage.tsx`（退役）
- 依赖：FE-04、FE-01 ｜ 估算：**L** ｜ 替换：NovelPage 整页；保留 GateBanner/OnboardingCard/TabProgressButton/useNovelState 文件

### FE-06 `App.tsx` 路由收敛 + 删死子路由
- 类型：**改造**
- 说明：收敛为 `/novel/:id` 单 index；删除 `settings/world/style/anti-ai/hooks/outline/prompts/write/archives/threads` 死子路由（全部 `redirect ..`）。
- 怎么做：`<Route path="/novel/:id" element={<NovelLayout/>}><Route index element={<NovelWorkspace/>}/></Route>`。
- 验收标准：`tsc --noEmit` 通过；`/novel/:id` 直达工作台；旧死路由 404 或回退 index（不再有 Navigate 死链）。
- 涉及文件：`src/App.tsx`
- 依赖：FE-05 ｜ 估算：**S** ｜ 复用：—

### FE-07 `useWorkbench` + `VolumeEntry` 类型扩展
- 类型：**新建**（hooks/）
- 说明：组装 project 元信息 + 树（DB-backed `/volumes` 全量 + `has_prose`，后端 P1 前降级用 `/volumes` 旧形状）+ 当前卷/章选中态 + 四态 view + 归档同步。**树与选中态跨视图（工作台/高级大纲）共享同一份数据**，双轨写同一 PUT 端点，无状态分裂（C3/R3）。
- 怎么做：
  - `hooks/useWorkbench.ts`：`{ project, volumes, selectedId, selectedRef, view, setView, expandedIds, onToggle, onSelectNode, createVolume, createChapter, renameNode, deleteNode, refresh, focusNode(ref) }`。
  - `VolumeEntry` 类型（`hooks/useOutline.ts`）扩 `has_prose?: boolean; archived?: boolean`（`??` 兜底向后兼容，N1）。
  - 共用 `useChapterData` 缓存池（Map<ref, chapterData>），打开前 flush/refetch（N16）。
- 验收标准：工作台树与高级大纲树渲染同一 `volumes` 数组；切视图树选中态不丢；`focusNode(ref)` 可定位。
- 涉及文件：`src/hooks/useWorkbench.ts`（新）、`src/hooks/useOutline.ts`（类型扩展）
- 依赖：FE-05 ｜ 估算：**M** ｜ 复用：NovelPage 的 expandedIds/selectedId/loadVolumes 逻辑（L261–333）

---

## M2 — 免费主流程纵切（P0-7，P0 断点 1）

### FE-08 `NovelBar`（小说栏）
- 类型：**新建**
- 说明：书名就地改名 + 类型 + **「高级配置 ▾（设定/大纲）」入口（N3）** + 归档 + 免费/PRO 提示。入口免费可见可进 + 「可选」标注（免费态 `alert-warning` 微标）。
- 怎么做：
  - `components/novel/NovelBar.tsx`：书名改名提取自 NovelPage 顶栏 `saveName` 逻辑（L553–569，savedRef 防双保存）；「高级配置」为 `menu` 下拉或两枚按钮 → `setView('advanced-settings')/setView('advanced-outline')`；归档 → `setView('archives')`。
  - 类型位：`project.type || project.genre`（后端补 `type/genre` 前为空降级）。
  - 免费提示：`tier==='none'` 显示「免费 · 完整人工写作（限 1 部作品）」。
- 验收标准：主工作台顶层可见「高级配置 ▾」且免费可进（N3 显式）；书名 blur/Enter 保存、Esc 取消、无双保存；「可选」标注在免费态出现。
- 涉及文件：`src/components/novel/NovelBar.tsx`（新）
- 依赖：FE-05、FE-01/03 ｜ 估算：**M** ｜ 复用：NovelPage 顶栏 rename（L553–569）

### FE-09 `Breadcrumb`（面包屑）
- 类型：**新建**
- 说明：作品 / 卷 / 章，`h-9` 轻量，仅正文工作台渲染；**卷/章段可点击跳转（N17）**；专注模式保留面包屑栏。
- 怎么做：`components/novel/Breadcrumb.tsx`：`作品名 / 第N卷 / 第N章`，卷/章段按钮 → `focusNode/onSelectNode`；当前节点高亮；树收起时仍可导航。
- 验收标准：点击卷段选中该卷、点击章段选中该章并进入编辑器；专注模式仍可见。
- 涉及文件：`src/components/novel/Breadcrumb.tsx`（新）
- 依赖：FE-05、FE-07 ｜ 估算：**S** ｜ 复用：—

### FE-10 `Workbench`（两栏容器）
- 类型：**新建**
- 说明：左 `WritingTree` + 右编辑器区 + `BottomStatusBar`；持 `focusMode` 状态（Workbench 级）。专注模式隐藏左树 + EditorToolbar，**保留面包屑与底部状态栏**（C6/UX §4 C4），`Esc` 退出。
- 怎么做：`components/novel/Workbench.tsx`；focusMode 提升到本组件（非 ChapterEditor 内部）；专注时正文 `max-w-3xl mx-auto` 居中；空态渲染改造后 `EmptyState`。
- 验收标准：focusMode 开关在编辑器失焦态也可用（Esc 全局监听）；专注模式仅剩面包屑 + 正文 + 底部状态栏。
- 涉及文件：`src/components/novel/Workbench.tsx`（新）
- 依赖：FE-05、FE-11、FE-13、FE-27 ｜ 估算：**M** ｜ 替换：NovelPage 的 dual-panel 布局（L984–1042）

### FE-11 `WritingTree`（工作台树）
- 类型：**新建**（包装 `StructureTree`）
- 说明：树基元复用 `StructureTree`（editable/onDelete/actions 已具备）；新增：**常驻「+ 新建卷」「+ 新建章」（N1）**、空章「未写」弱化可见（**不做硬过滤**）、hover 配置/重命名/删除（N2）、字数/归档徽标、存档态 📦 同步。
- 怎么做：
  - `components/novel/WritingTree.tsx`：顶部两枚入口按钮 → `useWorkbench.createVolume/createChapter`（新章即达编辑器，N1 验收）；树节点组装参考 NovelPage `writingTreeNodes`（L294–333）改走 `/volumes` 全量树。
  - **过滤规则（N1）**：默认全显；空章（`!has_prose && !isSelected && 非本会话新建`）弱化显示「未写」灰字；不做硬过滤。`has_prose` 缺失时降级（当前卷/章恒显示 + 本地已载入 prose 判断，FE R11）。
  - `StructureTree` 最小扩展：行内新建插槽（新增 `onAddChild?: (node) => void` 渲染「+」于卷节点 hover）——尽量少改核心结构，图标 props 注入。
  - 徽标：字数 `ch.word_count`、归档 📦、未写「未写」。
- 验收标准：树常驻「+新建卷/章」；点击「+新建章」→ 自动建卷（无卷时）→ 建「第N章」→ **立即进入编辑器可写（N1 显式）**；hover 卷/章出现 配置/重命名/删除；空章弱化可见不被过滤。
- 涉及文件：`src/components/novel/WritingTree.tsx`（新）、`src/components/novel/StructureTree.tsx`（改造：行内新建插槽）
- 依赖：FE-05、FE-07、FE-10 ｜ 估算：**L** ｜ 替换：NovelPage 的 writingTreeNodes + handleCreateVolume/handleCreateChapter（L465–528）

### FE-12 `ChapterEditor` 重构（AI 面免费隐藏 + 抽取 `useChapterData`）
- 类型：**改造**
- 说明：拆出 `useChapterData`；P0 阶段正文仍用 textarea（ProseEditor 见 FE-15）；**AI 面免费不渲染、代码保留**（N14/P0-6）：prompt tab / AI 写本章 / 质量检查 handleQualityCheck / RightToolbar 接线 → 挂 `<TierGate feature="ai-generate">` 隐藏；保存四态（含失败重试）对齐。
- 怎么做：
  - 从 `ChapterEditor.tsx` 移除 AI 状态与 handler（continue/polish/expand/streaming/qualityCheck/prompt tab/ContrastPreviewModal/RightToolbar 依赖），移入 `ChapterEditorAi.tsx`（保留文件）或 `if (isPro)` 分支；`ChapterEditorHandle` 保留但 AI 方法置空降级。
  - 保存改用 `useChapterData`；`saveFnRef/dirty 快照` 迁移到 hook 内；自动保存防抖 3000→1500ms（N8 配套）。
  - `onAIStateChange` prop 在免费态不接线（删除 NovelPage 的 RightToolbar 渲染链路，见 FE-10）。
- 验收标准：免费态无「AI 写本章/提示词/质量检查」按钮渲染；pro 态恢复既有 AI 路径；手动保存 + 1.5s 自动保存可用；「保存失败」出现「重试」。
- 涉及文件：`src/components/novel/ChapterEditor.tsx`（改造）
- 依赖：FE-03、FE-13 ｜ 估算：**L** ｜ 替换：NovelPage 中 ChapterEditor + RightToolbar 组合（L615–647）

### FE-13 `useChapterData`（章数据 hook）
- 类型：**新建**（hooks/）
- 说明：从 `ChapterEditor` 抽取：载入 prose/summary/status、1.5s 防抖自动保存、**保存四态**（自动保存中 / 已保存 / 未保存 / 失败含重试）、归档态。`ChapterEditor` 与两个配置抽屉共用（FE-19/20）。
- 怎么做：
  - `hooks/useChapterData.ts`：`{ chapter, prose, summary, status, isDirty, saveState, wordCount, targetWords, setTargetWords, save, retry, archive, unarchive, loading, error }`。
  - 保存端点：优先 `PUT .../chapters/{ref}/prose`（body `{prose}`，后端 #12）；后端未就位降级走 `PUT /chapters/{ref}` 全量。
  - `countChars` 统一去空白中文字符数（与后端 `/tree` 同口径 B5/P2-J）；`targetWords` 持久化（localStorage 或 chapter 元数据）。
  - 卸载/切章 flush 未落盘改动（防丢窗口）；`isDirty = prose !== initialProse || summary !== initialSummary || status !== initialStatus`。
- 验收标准：1.5s 停输后自动保存；四态正确流转；失败态出现重试；切章 flush；`tsc --noEmit` 通过。
- 涉及文件：`src/hooks/useChapterData.ts`（新）
- 依赖：FE-12 ｜ 估算：**M** ｜ 复用：ChapterEditor 现有 save 逻辑（L243–279）

### FE-14 `BottomStatusBar`（底部状态栏 + 内嵌进度条）
- 类型：**新建**（从 ChapterEditor 抽取）
- 说明：实时字数 + 保存四态（含重试）+ **内嵌进度条（当前/目标 + 目标字数可调 N5）** 同排（N13/C6 两栏收敛，不建右栏进度卡）。`progress progress-primary h-1.5`。
- 怎么做：`components/novel/BottomStatusBar.tsx`；目标字数编辑态（点击目标值 → 输入框，change 写回 `useChapterData.setTargetWords`）；进度 = `wordCount / targetWords`；归档态进度定格。
- 验收标准：底部状态栏常驻工作台底；目标可调且即时更新进度条；保存四态 + 重试按钮呈现。
- 涉及文件：`src/components/novel/BottomStatusBar.tsx`（新）
- 依赖：FE-13 ｜ 估算：**M** ｜ 替换：ChapterEditor 内联状态栏（L765–786, 934–953）

> **P0 断点 1 验收**（FE-01~14 + 后端 P0-2/3/8 联调）：免费建书 → 直达正文工作台可写；树「+新建卷/章」→ 新建「第一章」即达编辑器；树 CRUD + 抽屉 + 目标字数闭环；自动保存/字数/归档只读可用；主工作台可见「高级配置 ▾」（N3）；全程无阶段催促 UI、无 AI 字段、无提示词；免费直呼 AI 端点 403；免费归档不 500（N9）。

---

## M3 — ProseEditor（P2-1/P2-2）

### FE-15 `lib/selectionContentEditable.ts`（contenteditable 选区捕获）
- 类型：**新建**（`lib/`）
- 说明：基于 `document.getSelection` + Range → **纯文本 start/end 偏移**；textarea 版 `lib/selection.ts` 保留。
- 怎么做：`captureSelectionCE(container: HTMLElement)`：getSelection + Range，把 Range 与容器内所有文本节点累加长度换算为纯文本 start/end；导出 `useSelectionCaptureCE(containerRef)`（mouseup/keyup 更新）。
- 验收标准：在 ProseEditor 内选择文本 → 返回的 `{start,end,text,fullText}` 与纯文本索引一致（含多段落）；供 PRO 恢复复用（FE P1-4）。
- 涉及文件：`src/lib/selectionContentEditable.ts`（新）
- 依赖：— ｜ 估算：**M** ｜ 复用：—（与 selection.ts 并存）

### FE-16 `ProseEditor`（contenteditable 受控编辑器，最大新件）
- 类型：**新建**（替换 ChapterEditor 内 textarea）
- 说明：**N8 受控回写策略定稿落地**：DOM→state 单向、IME 守卫、粘贴净化；字号/行距；专注；归档只读。暴露 `getPlainText/setPlainText/captureNow`。
- 怎么做：
  - `components/novel/ProseEditor.tsx`：
    - 持 `contentRef`，**仅在载入 / `setPlainText()` 时写 `innerHTML`**（prose → 按 `\n\n+` 拆段 → `<p>` 渲染，章标题由元数据单独渲染不入 HTML）。
    - `onInput` 只遍历子节点序列化为纯文本（段落 `\n\n` join、段内换行拍平）→ `onChange(plainText)`（供 useChapterData 保存/字数），**不让 React 因 state 变化重渲染编辑器 DOM**（防每键跳光标）。
    - **IME 守卫**：`onCompositionStart/End` 期间不序列化、不触发防抖保存。
    - **粘贴净化**：`onPaste` 拦截，白名单 `p/br/strong/em` 其余拍平为纯文本/段。
    - 序列化只输出纯文本（杜绝 HTML 写回 YAML）；`countChars` 与存储同一份纯文本。
    - 字号/行距：CSS 变量 `--prose-size/--prose-leading` 作用于容器（15/17/19px、1.8/2.0/2.2，默认 17px/2.0，UI M7）；偏好 localStorage；由 EditorToolbar 传入。
    - 归档只读：`status==='archived'` → `contentEditable=false`（或只读渲染）+ 顶层 `ArchiveBanner` + 工具条禁用 + 进度定格。
  - 升级 `ChapterEditor` 内 textarea 为该组件；AI 流式渲染分支（streaming 预览）保留在 PRO 容器侧。
- 验收标准：连续输入无光标跳；中文 IME 组词期间不触发保存/字数跳动；粘贴富文本净化为纯文本段落；字号/行距切换即时生效且跨会话记忆；归档后不可编辑（B6 明确这是全新工作）；`getPlainText/setPlainText/captureNow` 契约可用。
- 涉及文件：`src/components/novel/ProseEditor.tsx`（新）、`src/components/novel/ChapterEditor.tsx`（textarea→ProseEditor）
- 依赖：FE-13、FE-15、FE-17、FE-18 ｜ 估算：**L** ｜ 替换：ChapterEditor textarea（L735–744, 903–912）

### FE-17 `EditorToolbar`（正文工具条）
- 类型：**新建**（从 ChapterEditor 抽取）
- 说明：字号/行距分段（`join join-horizontal`）+ 专注 + 版本历史 + 归档本章；归档态禁用。`join` + `btn`。
- 怎么做：`components/novel/EditorToolbar.tsx`：props `{ font, leading, onFontChange, onLeadingChange, onFocus, onVersion, onArchive, archived }`；专注/归档进 FeatureTier 不做限制（免费可用）。
- 验收标准：字号/行距分段选择器与 ProseEditor CSS 变量联动；归档态「归档本章」禁用；版本历史入口打开 `VersionHistory`。
- 涉及文件：`src/components/novel/EditorToolbar.tsx`（新）
- 依赖：FE-16 ｜ 估算：**M** ｜ 替换：ChapterEditor 内联工具条（L829–854, 955–973）

### FE-18 `ArchiveBanner`（归档只读提示条）
- 类型：**新建**
- 说明：归档只读提示条（`alert alert-warning`）+ **「取消归档，继续编辑」（N6）** → `POST /chapters/{ref}/unarchive`（后端 P1-7 已备）；树 📦 同步 + 进度定格。
- 怎么做：`components/novel/ArchiveBanner.tsx`：`{ chapterRef, onUnarchive, onViewTree }`；unarchive 成功 → 刷新 useChapterData/useWorkbench 树（归档态清除）。
- 验收标准：归档章顶部出现提示条 + 「取消归档，继续编辑」；点击后编辑器恢复可编辑、树 📦 移除、进度恢复。
- 涉及文件：`src/components/novel/ArchiveBanner.tsx`（新）
- 依赖：FE-16、FE-13 ｜ 估算：**S** ｜ 复用：—

---

## M4 — 工作台抽屉（P2-3）

### FE-19 `VolumeConfigDrawer`（卷配置抽屉）
- 类型：**新建**
- 说明：卷名 + 卷摘要（免费）；抽屉互斥、事件不冒泡；PRO 追加全字段（🔒/隐藏）。复用 `VolumeEditor` 保存逻辑（`PUT /volumes/{filename}`）。
- 怎么做：`components/novel/VolumeConfigDrawer.tsx`：`drawer drawer-end w-[400px]`；`{ open, volumeRef, projectId, onClose, onSaved }`；摘要级字段 + `<TierField feature="outline-advanced-fields">` 锁定卷纲高级字段；「去写正文」→ 关抽屉 + 选中卷内第一章。
- 验收标准：树卷节点 hover「配置 →」打开抽屉；改名/摘要保存走 `PUT /volumes/{ref}`；两个抽屉同时只开一个；PRO 高级字段 free 隐藏/锁定。
- 涉及文件：`src/components/novel/VolumeConfigDrawer.tsx`（新）
- 依赖：FE-05、FE-07、FE-03 ｜ 估算：**M** ｜ 复用：VolumeEditor 保存逻辑（L108–121）

### FE-20 `ChapterConfigDrawer`（章配置抽屉）
- 类型：**新建**
- 说明：章名 + 摘要 + **目标字数（N5，免费）** +「去写正文」+「完整字段 →」跳高级大纲并定位节点（N16）。
- 怎么做：`components/novel/ChapterConfigDrawer.tsx`：与 FE-19 互斥；数据走 `useChapterData` 缓存（打开前 flush/refetch 防 merge 覆盖，N16）；保存 `PUT /chapters/{ref}`；「完整字段 →」→ `setView('advanced-outline', { focusRef })` + `useWorkbench.focusNode(ref)`。
- 验收标准：树章节点 hover「配置 →」打开；目标字数可调并联动底部进度条；「完整字段 →」跳高级大纲视图并高亮该章；无状态分裂（抽屉与面板同一缓存）。
- 涉及文件：`src/components/novel/ChapterConfigDrawer.tsx`（新）
- 依赖：FE-13、FE-19 ｜ 估算：**M** ｜ 复用：OutlineEditor 摘要字段 + useChapterData

---

## M5 — 高级配置 · 设定（P2-4）

### FE-21 `AdvancedSettingsView`（设定 7 项 + n/7 + 三态徽标 + tier 显隐）
- 类型：**新建**
- 说明：7 项展示口径 = genre/synopsis/world/style/anti-ai/hooks/characters（**ai-model 移出树、synopsis 新增为树节点，N12**）；顶部「设定 n/7」进度（7/7 换 `progress-success`）；三态徽标；题材级配置**免费可填 + PRO 消费（O6）**；PRO 字段 `TierField` 🔒；免费态「必填」→「建议填写」（N4）；懒挂载；「返回正文 →」。**修复 03-settings 6/7 进度 bug（画 7 项/JS 按 7/显示 n/7，O5）。**
- 怎么做：
  - `components/novel/AdvancedSettingsView.tsx`：左 7 项树 + 右表单；顶部进度条 + 返回入口。
  - 复用 `SettingsFormField` + 各 `*SettingForm`；`settingsStatus` 从 `useOnboarding` 迁移为「确认状态」数据源（或新 `useSettingsStatus`）。
  - `SettingsProgressBar` 合并进本组件内部；`SettingNodeBadge` 可拆出（FE-22）。
  - 7 项完成判定：genre/synopsis/world/style/anti-ai/hooks/characters 各自 confirmed；synopsis 独立树节点面板（复用 `SynopsisCard`）。
- 验收标准：设定 7 项（无 ai-model）+ n/7 进度正确（7/7 变色）；免费态题材级配置可填、AI 消费字段 🔒；免费态「建议填写」措辞；进入/返回不丢工作台脏状态。
- 涉及文件：`src/components/novel/AdvancedSettingsView.tsx`（新）
- 依赖：FE-03、FE-05 ｜ 估算：**L** ｜ 替换：NovelPage settings tab（L579–586）+ SETTINGS_TREE_ITEMS（L75–83）

### FE-22 `SettingNodeBadge`（四态统一徽标）
- 类型：**新建**（可并入 FE-21，仅抽基元）
- 说明：**状态语言全站唯一四态（N15）**：未填 ○ / 进行中 ● / 已确认 ✓ / 已归档 📦，`badge` 胶囊（ghost/warning/success/neutral）。
- 怎么做：`components/novel/settings/SettingNodeBadge.tsx`；props `{ status: 'unfilled'|'in_progress'|'confirmed'|'archived', size }`；树/进度/大纲视图统一引用（不直接用 `shared/StatusBadge`——那是 API 配置徽标）。
- 验收标准：四态视觉唯一；同一章节在树与大纲视图徽标一致。
- 涉及文件：`src/components/novel/settings/SettingNodeBadge.tsx`（新）
- 依赖：FE-21 ｜ 估算：**S** ｜ 复用：—

### FE-23 `SettingsFormField` + `SynopsisCard` 防重（N12）
- 类型：**改造**
- 说明：现状 `SettingsFormField` characters 分支内置 `SynopsisCard` 且其余面板全局常驻（L47–49）→ 双份风险；synopsis 设为独立树节点后，需防重复渲染。
- 怎么做：`SettingsFormField.tsx` 移除全局常驻 `SynopsisCard`；`synopsis` 面板 = 独立 `SynopsisCard` 卡片（AdvancedSettingsView 树节点 → synopsis → 只渲染 SynopsisCard）；characters 面板不再内嵌 synopsis。
- 验收标准：7 项树中 synopsis 面板渲染一次且唯一；characters 面板无重复简介卡。
- 涉及文件：`src/components/novel/SettingsFormField.tsx`（改造）、`src/components/novel/SynopsisCard.tsx`（复用）
- 依赖：FE-21 ｜ 估算：**M** ｜ 复用：SynopsisCard

---

## M6 — 高级配置 · 大纲（P2-5）

### FE-24 `AdvancedOutlineView`（卷/章全字段面板）
- 类型：**新建**
- 说明：左卷/章树 + 右上下文面板（全字段）；缺字段提示 + 批量确认；状态语言四态（N15）；与抽屉共用 `useWorkbench` 同一 chapterData 缓存（N16）；返回正文。
- 怎么做：
  - `components/novel/AdvancedOutlineView.tsx`：左 `WritingTree` 变体（outline 数据源 `useWorkbench` 共享）+ 右面板；`focusRef` 高亮定位（自 N16 跳转进入）。
  - 章面板 → `ChapterConfigPanel`（FE-26）；卷面板 → `VolumeConfigPanel`（FE-25）；批量确认（`onConfirmChapter`/全局确认）复用 `useOutline.confirmChapter`。
  - 缺字段提示：未填章弱化 + 点击跳转定位。
- 验收标准：进入高级大纲见卷/章树 + 上下文面板；抽屉「完整字段 →」可定位高亮；批量确认可用；返回正文不丢工作台状态。
- 涉及文件：`src/components/novel/AdvancedOutlineView.tsx`（新）
- 依赖：FE-05、FE-07、FE-19/20 ｜ 估算：**L** ｜ 替换：NovelPage volume/chapter tab（L673–787）

### FE-25 `VolumeConfigPanel`（卷纲全字段面板）
- 类型：**新建**（净新增表单，FE P0-3，无现成复用）
- 说明：卷纲全字段（结构模板 / 核心冲突 / 情绪走向 / 信息差 / 冲突阶梯 / 场景卡）；存 `volumes/vol-N.yaml`（PRO 字段 `TierField` 🔒，免费只渲染摘要级）；批量确认。
- 怎么做：`components/novel/outline/VolumeConfigPanel.tsx`：基于 `VolumeEditor` 保存逻辑扩展全字段表单；字段定义见 tech-frontend §2.2 #15；复用 `Field/InputField/ListEditor/TabBar/SaveButton`。
- 验收标准：卷纲全字段可编辑保存；free 态高级字段锁定；批量确认置卷状态。
- 涉及文件：`src/components/novel/outline/VolumeConfigPanel.tsx`（新）
- 依赖：FE-24 ｜ 估算：**L** ｜ 复用：VolumeEditor 保存 + FormField 基元

### FE-26 `ChapterConfigPanel`（章纲全字段面板）
- 类型：**新建**（改造复用 `OutlineEditor`）
- 说明：章纲全字段（方向/key_points/情绪/钩子/段落/目标字数）；复用 `OutlineEditor` 改右面板形态（去 onBack/全页壳）；PRO 字段 `TierField`。
- 怎么做：`components/novel/outline/ChapterConfigPanel.tsx`：包装/重构 `OutlineEditor`（去掉 `onBack` 与 `max-w-3xl` 全页壳，右面板自适应）；数据走 `useChapterData`/`useOutline.chaptersMap` 共享缓存；目标字数写入 `useChapterData.setTargetWords` 同源。
- 验收标准：章纲全字段在右面板编辑保存；与工作台抽屉目标字数同源不覆盖（N16 防 merge）；free 态 `outline-advanced-fields` 锁定。
- 涉及文件：`src/components/novel/outline/ChapterConfigPanel.tsx`（新）、`src/components/novel/outline/OutlineEditor.tsx`（改造）
- 依赖：FE-24、FE-13 ｜ 估算：**M** ｜ 复用：OutlineEditor 表单（去 onBack/全页壳）

---

## M7 — archives + EmptyState（P2-6）

### FE-27 `ArchivesView`（归档视图 + 归档可逆）
- 类型：**新建**（接线复用组件）
- 说明：四态 archives 视图；接线 `ArchivePage/ArchiveReader`；**unarchive 入口（N6）**（后端 P1-7 已备）；与「编辑器内只读」是两回事（B6），别混用。
- 怎么做：`components/novel/ArchivesView.tsx`：`ArchivePage`（项目级）+ `ArchiveReader`（文件级）+ unarchive 按钮；视图顶层「返回正文 →」。
- 验收标准：归档列表可读；可逆入口可把章节拉回工作台并解除只读；返回正文不丢工作台状态。
- 涉及文件：`src/components/novel/ArchivesView.tsx`（新）、复用 `ArchivePage.tsx`/`ArchiveReader.tsx`
- 依赖：FE-05 ｜ 估算：**M** ｜ 复用：ArchivePage/ArchiveReader

### FE-28 `EmptyState`（建书即写空态）
- 类型：**改造**
- 说明：建书即写空态：添加卷 / 添加章 + 高级配置次级链接 + 「先写正文」；**去设定门控**（移除 `settingsComplete/bypass` 分支，N4：设定不再前置）。
- 怎么做：`EmptyState.tsx`：`onCreateVolume/onCreateChapter/onGoAdvanced`（高级配置「可选」标注）；不再依赖 `settingsComplete`。
- 验收标准：新书无卷无章时呈现「添加卷/章 + 先写正文」；不再出现「先去设定」阻断。
- 涉及文件：`src/components/novel/EmptyState.tsx`（改造）
- 依赖：FE-05、FE-08 ｜ 估算：**M** ｜ 改造：去 settingsComplete/bypass 门控

---

## M8 — 数据契约联调（P1-5/P1 断点）

### FE-29 `useOutline` 树数据源切 `/volumes` + `VolumeEntry` 扩展
- 类型：**改造**（breaking change 同 commit 迁移，N11）
- 说明：后端 P1-3/4/5 就位后，`GET /volumes` 返回**全量卷+章树（含 has_prose/archived/outline_status，不做正文过滤）**；`useOutline` 树数据源从 `/tree` 切 `/volumes` 新形状；`POST /chapters` 替代为卷内建章（breaking change 前端同步迁移）。
- 怎么做：`hooks/useOutline.ts` refetchTree 改 `api.get('/novels/{id}/volumes')`（响应 `{volumes:[...]}`）；`VolumeEntry` 已扩 `has_prose/archived`；建章改 `POST /novels/{id}/volumes/{ref}/chapters`；`POST /novels/{id}/chapters` 移除。
- 验收标准：大纲视图/工作台树/字数/进度/归档态全部走 DB；`useOutline` hook 内部零改动消费方（FE-24 等）可无缝切换；`tsc --noEmit` 通过。
- 涉及文件：`src/hooks/useOutline.ts`（改造）
- 依赖：FE-07、FE-24（后端 P1-3/4/5 同步）｜ 估算：**M** ｜ 复用：—

### FE-30 `WritingTree` 过滤切真 `has_prose`
- 类型：**改造**
- 说明：后端 `/volumes` 带真 `has_prose/archived` 后，`WritingTree` 过滤/弱化规则从降级方案切换到真实 `has_prose`（N1：空章弱化、不硬过滤）。
- 怎么做：`WritingTree.tsx` 过滤逻辑读取 `node.has_prose`；降级分支（本地已载入 prose 判断）删除。
- 验收标准：空章「未写」弱化基于后端 `has_prose`；新会话新建章即时可见。
- 涉及文件：`src/components/novel/WritingTree.tsx`（改造）
- 依赖：FE-11、FE-29 ｜ 估算：**S** ｜ 复用：—

---

## M9 — token 化 + 双主题 + a11y（P2-7）

### FE-31 mockup→token 双主题收敛 + 状态语言全站统一
- 类型：**改造**（全局样式 + 组件基元）
- 说明：**N7 映射表落地**（amber-600→primary、stone-100→base-100、emerald→success、stone-300→base-content/30 等）；亮/暗双主题验收（现 tailwind.config 已有 `novelforge` 暗 + `parchment` 亮）；**状态语言四态唯一（N15）**；对比度 WCAG AA（功能文本 ≥4.5:1）；树/抽屉 a11y（focus-within 可发现、Esc、焦点管理）。
- 怎么做：
  - 审计 `src/index.css` + 各组件硬编码色（如 ChapterEditor 内 `text-amber-600 dark:text-amber-400` L877、index.css 暖光晕 rgba 硬色）→ 换 daisyUI token。
  - 四态 badge 胶囊统一（关联 FE-22 `SettingNodeBadge`）；全站替换零散「待设定/已设定/进行中」文案为统一徽标。
  - a11y：StructureTree/WritingTree `focus-within` 高亮、抽屉 Esc 关闭 + 焦点 trap、`aria-current` 标注当前节点。
  - 验收：`npx tsc --noEmit`；亮/暗主题手工对照 01–04 高保真。
- 验收标准：无硬编码色残留（grep 抽查 `text-amber|#d4a373` 等）；四态徽标全站一致；功能文本对比度 ≥4.5:1；键盘可完整操作树与抽屉。
- 涉及文件：`src/index.css`（改造）、`src/tailwind.config.js`（复核）、WritingTree/StructureTree/各 drawer/SettingNodeBadge（改造）
- 依赖：FE-10、FE-11、FE-14、FE-16、FE-19~28 ｜ 估算：**L** ｜ 复用：—

---

## M10 — 高保真四页验收 + E2E（P2-8）

### FE-32 01-list 对齐（O1 三处显式化）
- 类型：**改造**
- 说明：O1 owner 裁定「保留限 1 本 + 三处显式化」：创建弹窗提示升级为转化锚点「升级 PRO 解锁多本」；列表满额显示「已用 1/1，升级解锁更多」**而非隐藏入口**；卡片「继续创作 →」主按钮 + 阶段标签 + 免费限 1 提示。
- 怎么做：`NovelListPage.tsx` 满额态渲染占位卡（升级锚点）+ `CreateProjectModal.tsx` 文案升级（现已有 `freeLimitReached` alert，L195–200）；卡片主按钮「继续创作 →」；阶段标签取 `current_phase` 映射。
- 验收标准：免费满 1 本后仍可见创建入口（升级锚点）；卡片主按钮直达工作台；弹窗提示文案含「升级 PRO 解锁多本」。
- 涉及文件：`src/pages/NovelListPage.tsx`（改造）、`src/components/novel/CreateProjectModal.tsx`（改造）
- 依赖：FE-01、FE-31 ｜ 估算：**M** ｜ 改造：O1 显式化

### FE-33 02-writing / 03-settings / 04-outline 逐页对齐 + 接真数据
- 类型：**验收 + 修正**
- 说明：02-writing（两栏 C6 + 底部进度条 N13）/ 03-settings（7 项无 bug）/ 04-outline（免费态字段显隐蓝本）逐页对照高保真并接真数据。
- 怎么做：对 `docs/prd/pages/01–04` 每页开 checklist 验收单，逐项勾选；差异走 FE-31 基元收敛或组件微调；`theme` 双主题分别截图对照。
- 验收标准：四页与高保真逐像素/逐字段对齐（允许 token 化等效）；03 无 6/7 bug；04 免费态字段显隐符合能力清单。
- 涉及文件：`src/components/novel/*`（视差异微调）
- 依赖：FE-10~31 ｜ 估算：**M** ｜ 复用：—

### FE-34 E2E 免费主流程补测
- 类型：**新建**（e2e/）
- 说明：对齐 PRD §8 + N1 的免费主流程 E2E：建书即写 → 树 CRUD → 抽屉 → 写作自动保存 → 归档只读 → 树/进度同步；N1 新建章节即达编辑器；全程无 AI 字段与提示词；免费直呼 AI 端点 403；免费归档不 500（N9）。
- 怎么做：`e2e/free-writing-flow.spec.ts`（沿用 `creation-flow.spec.ts` 基建 + `helpers.ts` `url()`）；测试数据走后端 mock（`SERVER_API_BASE`）；断言保存四态、进度条、只读态、无 AI 按钮、403 占位。
- 验收标准：免费主流程全绿；CI（C端 frontend build 或独立 workflow）接入；`npx playwright test` 通过。
- 涉及文件：`client/frontend/e2e/free-writing-flow.spec.ts`（新）
- 依赖：FE-33、后端 P0-8 联调 ｜ 估算：**L** ｜ 复用：creation-flow 基建

---

## P3 — PRO 解锁占位（范围外，只留接口）

### FE-35 PRO 解锁逻辑占位
- 类型：**新建**（占位）
- 说明：AI 生成正文（流式/API/计费）、提示词面板 UI、AI 字段 PRO 解锁——本次只留 tier 开关 + 能力清单 + 端点门控占位；P3 再把 `require_ai_access` 语义从「有无 API Key」改为「tier 是否 PRO」，并在 FeatureTier 门控下恢复既有 AI 代码路径（RightToolbar/PromptManagementPage/AiReview* 已保留）。
- 怎么做：`lib/features.ts` 已是能力清单（FE-02）；`ProContainer`（FE-05）即 PRO 开关；确认 AI 代码路径未被删除（grep ChapterEditor/RightToolbar/AiReview*）。
- 验收标准：无 AI 生成/提示词 UI 实现；tier 切 PRO 后既有组件可按计划恢复（接口占位就绪）。
- 涉及文件：各已保留组件（无新增实现）
- 依赖：FE-01~34 ｜ 估算：**S** ｜ 复用：已保留 AI 组件

---

## 验收锚点对照（development-plan §8 / consensus §4）

| 期 | 断点/任务 | 满足的 FE |
| --- | --- | --- |
| P0 | 免费建书→正文工作台可写；树 CRUD + 抽屉 + 自动保存 + 归档只读；高级配置▾可见（N3）；无 AI 字段/阶段催促 UI | FE-01~14（含断点 1）+ 后端 P0-2/3 |
| P1 | 卷/章元数据入 DB；树/字数/进度/归档走 DB；`GET /volumes` 全量 + has_prose；breaking change 同 commit 迁移 | FE-29/30（+ 后端 P1-1~7） |
| P2 | 四层栏 + 两栏 + 底部进度条；contenteditable 无游标跳/IME 无损（N8）；高级配置独立视图；状态语言四态（N15）；token 双主题（N7）；01–04 对齐 + E2E | FE-15~31（断点 2）、FE-32~34 |
| P3 | PRO 解锁接口占位 | FE-35 |

## 注（notes）
1. `client/frontend/AGENTS.md` 宣称 Next.js 实为 Vite+React 19，**过时误导，实施时忽略**（B8）。
2. 本拆分仅覆盖**前端**；后端 P0-2（tier 旁路 N9）、P0-3（归档免费化）、P1-1~7（数据底座/端点/测试）、P0-6 后端侧（settings/ai_router 补挂 require_ai_access）为前端 FE 的前置联调依赖，已在各 FE 依赖标注。
3. 前端对既有 AI 代码遵循「精准修改」：保留不删，仅 FeatureTier 隐藏/ProContainer 隔离。
4. 估算口径：S ≤1d、M 1–2d、L 3–5d（单人）；含测试与 `tsc --noEmit`。
