# 免费工作台纵切（004-free-workspace）

## Why

P0 截止线（sprint-plan §4.1）要求「免费建书即写」的完整闭环，但当前 `NovelPage` 是围绕六阶段 tabs + 阶段门控 + AI 工作流写的单一巨石（1077 行）：

- **无四态视图机**：settings/卷纲/章纲/提示词/正文/归档是六个 tab 平铺，正文 tab 仅是其中之一；新书默认落点在设定 tab（`useEffect` 把 `writing` 强切回 `settings`），违背 C5「写作恒为主界面」。
- **无免费主流程**：EmptyState 前置「设定未完成」门控（settingsComplete/bypass），免费用户建书后被堵在设定页，无法「建书即写」（N1/N4）。
- **AI 面与正文耦合**：`ChapterEditor` 内含 prompt tab / AI 写本章 / 质量检查 / ContrastPreviewModal / RightToolbar 链路，免费态无法整棵子树隐藏（N14）。
- **阶段催促 UI 全站可见**：phase-status / GateBanner / OnboardingCard 在免费态照常渲染与请求，违背「免费无阶段催促、无 AI 字段、无提示词」（P0-6 / 4.1-8）。
- **旧路由死链**：`/novel/:id/settings|outline|prompts|write|archives` 等子路由 `Navigate to=".."` 仍是死链，无新工作台承载。

change 003 已铺设地基（LicenseProvider / useTier / ProjectShell / useProject / TierGate / TierField），但 `NovelPage` 仍用局部 `setProject`/`setUserTier`，两态能力未被工作台消费。

## What Changes

### 能力 `novel-workspace`（FE-05 / FE-06）

1. `components/novel/NovelWorkspace.tsx`（新，替换 `pages/NovelPage.tsx` 退役）：四态视图机 `workbench | advanced-settings | advanced-outline | archives`。**Workbench 常驻挂载**，切视图用 `hidden` 切换（保 prose 脏状态/光标不丢）；advanced/archives 首次访问懒挂载、离开卸载（FE P1-1）。默认落点 `workbench`（C5/P0-5）。
2. `components/novel/ProContainer.tsx`（新）：`useTier().isFree ? null : <>{children}</>`。`useNovelState`（phase-status）/ TabProgressButton / GateBanner / OnboardingCard 收进 ProContainer 子树，免费态整棵不渲染、不请求（杜绝 hook 条件调用）。
3. `App.tsx` 路由收敛：`/novel/:id` 单 index → `NovelWorkspace`；删除 `settings/world|style|anti-ai|hooks|outline|prompts|write|archives|threads` 死子路由。

### 能力 `workbench`（FE-07 / FE-08 / FE-09 / FE-10 / FE-11 / FE-14 / FE-28）

4. `hooks/useWorkbench.ts`（新）：组装 project 元信息 + 卷章树（**后端 P1 未达时降级用当前 `/volumes` 旧形状**，逐卷 GET 拼 chapters）+ 当前卷/章选中态 + 四态 view + expandedIds + 树 CRUD（createVolume/createChapter/renameNode/deleteNode）+ `focusNode(ref)`。`VolumeEntry`（useOutline 导出）扩 `has_prose?/archived?`（`??` 兜底向后兼容，N1）。
5. `components/novel/NovelBar.tsx`（新）：书名就地改名（复用 NovelPage 顶栏 saveName 语义，savedRef 防双保存）+ 类型位 + **「高级配置 ▾（设定/大纲）」入口（N3）** + 归档 + 免费/PRO 提示（`tier==='none'` 显示「免费 · 完整人工写作（限 1 部作品）」）。
6. `components/novel/Breadcrumb.tsx`（新）：`作品名 / 第N卷 / 第N章`，`h-9` 轻量，卷/章段按钮 → `onSelectNode/focusNode`（N17）；专注模式保留。
7. `components/novel/Workbench.tsx`（新）：左 `WritingTree` + 右编辑器区 + `BottomStatusBar` 两栏容器；持 `focusMode`（Workbench 级，Esc 退出，专注时隐藏左树 + EditorToolbar、保留面包屑与底部状态栏、正文 `max-w-3xl mx-auto`）；空态渲染改造后 `EmptyState`。
8. `components/novel/WritingTree.tsx`（新，包装 `StructureTree`）：顶部常驻「+ 新建卷」「+ 新建章」（N1，新章即达编辑器）；空章「未写」弱化可见不硬过滤（N1，`has_prose` 缺失时降级当前卷/章恒显示）；hover 配置/重命名/删除（N2）；字数/归档徽标。`StructureTree` 最小扩展 `onAddChild?` 行内新建插槽。
9. `components/novel/BottomStatusBar.tsx`（新）：实时字数 + 保存四态（自动保存中/已保存/未保存/失败含重试）+ **内嵌进度条（当前/目标 + 目标可调 N5）** 同排（`progress progress-primary h-1.5`）。
10. `components/novel/EmptyState.tsx`（改造）：**去设定门控**（移除 settingsComplete/bypass 分支，N4）；呈现「添加卷 / 添加章 + 高级配置次级链接 + 先写正文」。

### 能力 `chapter-data`（FE-12 / FE-13）

11. `hooks/useChapterData.ts`（新）：从 ChapterEditor 抽取。载入 prose/summary/status + **1.5s 防抖自动保存** + 保存四态（含失败重试）+ 字数（去空白中文字符数，与后端 `/tree` 同口径 B5）+ 目标字数（localStorage 持久化）+ 归档态 + 卸载/切章 flush。保存端点优先 `PUT .../chapters/{ref}/prose`（后端 #12），未就位降级 `PUT /chapters/{ref}` 全量。
12. `components/novel/ChapterEditor.tsx`（改造）：AI 面免费隐藏、代码保留——prompt tab / AI 写本章 / 质量检查 / RightToolbar 接线挂 `<TierGate feature="ai-generate">`；`onAIStateChange` 免费态不接线；正文仍 textarea（ProseEditor 见 FE-15 后续 change）；保存改走 `useChapterData`；自动保存防抖 3000→1500ms（N8 配套）。

## Impact

- 前端新增：`components/novel/NovelWorkspace.tsx`、`components/novel/ProContainer.tsx`、`components/novel/NovelBar.tsx`、`components/novel/Breadcrumb.tsx`、`components/novel/Workbench.tsx`、`components/novel/WritingTree.tsx`、`components/novel/BottomStatusBar.tsx`、`hooks/useWorkbench.ts`、`hooks/useChapterData.ts`。
- 前端改造：`components/novel/ChapterEditor.tsx`、`components/novel/EmptyState.tsx`、`components/novel/StructureTree.tsx`（onAddChild 插槽）、`hooks/useOutline.ts`（VolumeEntry 扩展）、`App.tsx`（路由收敛）。
- 前端退役：`pages/NovelPage.tsx`（逻辑迁入 NovelWorkspace/Workbench 等）。保留 `TabProgressButton/GateBanner/OnboardingCard/useNovelState` 文件，供 ProContainer 内部复用。
- 测试：TE-16（四态视图机）/ TE-28（WritingTree 树 CRUD + 过滤）/ TE-29（免费/PRO 两态渲染）+ TE-17 免费主流程 E2E（FE-34）。
- 后端：本 change 不改后端；消费 change 002 的 tier bypass 契约与既有 `/volumes` 旧形状（DB-backed 全量树在 change 005 落地，届时前端降级逻辑自然切换）。
- 兼容：`NovelPage` 局部 `setProject`/`setUserTier` 收敛到 `useProject`/`useTier`；`useNovelState` 移入 ProContainer 后免费态不再请求 phase-status（4.1-8）。

## Rollout

1. `useChapterData`（FE-13）→ `ChapterEditor` 改造（FE-12）→ vitest
2. `useWorkbench` + `VolumeEntry` 扩展（FE-07）→ `WritingTree`/`StructureTree` 插槽（FE-11）→ `BottomStatusBar`（FE-14）→ `Breadcrumb`（FE-09）
3. `NovelBar`（FE-08）→ `Workbench` 两栏（FE-10）→ `EmptyState` 去门控（FE-28）
4. `NovelWorkspace` + `ProContainer`（FE-05）→ `App.tsx` 路由收敛（FE-06）→ 退役 NovelPage
5. TE-16/28/29 单测 + FE-34 E2E 免费主流程（TE-17）→ `npx tsc --noEmit && npx vitest run` 全绿
