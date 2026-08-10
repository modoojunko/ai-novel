# 免费工作台纵切 — Tasks

> FE-05 / FE-06 / FE-07 / FE-08 / FE-09 / FE-10 / FE-11 / FE-12 / FE-13 / FE-14 / FE-28 / FE-34 ｜ TE-16 / TE-17 / TE-28 / TE-29

## 能力 chapter-data（FE-13 → FE-12）

- [ ] `hooks/useChapterData.ts`（新，FE-13）：load（GET chapter）+ 1.5s 防抖自动保存 + 保存四态（autosaving/saved/unsaved/failed + retry）+ countChars（去空白中文）+ targetWords（localStorage）+ isDirty 三源 + 卸载/切章 flush + 保存端点降级（`PUT .../prose` → `PUT /chapters/{ref}` 全量）
- [ ] `components/novel/ChapterEditor.tsx`（改造，FE-12）：AI 面挂 `<TierGate feature="ai-generate">`（prompt tab / AI 写本章 / 质量检查 / RightToolbar 接线）；保存走 useChapterData；防抖 1500ms；`onAIStateChange` 免费态不接线；ChapterEditorHandle 保留 AI 方法免费 no-op；归档只读态

## 能力 workbench（FE-07 → FE-11/14/09 → FE-08 → FE-10/28）

- [ ] `hooks/useOutline.ts`（扩展）：`VolumeEntry` 加 `has_prose?/archived?`（`??` 兜底）
- [ ] `hooks/useWorkbench.ts`（新，FE-07）：project + 树（降级旧形状 + 逐卷拼 chapters）+ selectedId/selectedRef + view/setView + expandedIds/onToggle/onSelectNode + createVolume/createChapter/renameNode/deleteNode + refresh + focusNode
- [ ] `components/novel/StructureTree.tsx`（改造，FE-11）：`onAddChild?` 行内新建插槽（卷 hover「+」）
- [ ] `components/novel/WritingTree.tsx`（新，FE-11）：常驻「+ 新建卷/章」；新章即达编辑器；空章「未写」弱化不硬过滤；hover 配置/重命名/删除；字数/归档徽标
- [ ] `components/novel/BottomStatusBar.tsx`（新，FE-14）：字数 + 保存四态（含重试）+ 内嵌进度条 + 目标可调（N5）
- [ ] `components/novel/Breadcrumb.tsx`（新，FE-09）：`作品/第N卷/第N章`，卷/章可点跳转，h-9，专注模式保留
- [ ] `components/novel/NovelBar.tsx`（新，FE-08）：书名改名（savedRef 防双保存）+ 类型 + 「高级配置 ▾」（N3 免费可进 + 「可选」标注）+ 归档 + 免费提示
- [ ] `components/novel/Workbench.tsx`（新，FE-10）：左 WritingTree + 右编辑器 + BottomStatusBar；focusMode（Workbench 级，Esc 退出，专注隐藏左树 + 工具栏、保留面包屑 + 状态栏、正文 max-w-3xl 居中）；空态 EmptyState
- [ ] `components/novel/EmptyState.tsx`（改造，FE-28）：去 settingsComplete/bypass 门控；「添加卷/章 + 高级配置次级链接 + 先写正文」

## 能力 novel-workspace（FE-05 → FE-06）

- [ ] `components/novel/ProContainer.tsx`（新，FE-05）：`isFree ? null : <>{children}</>`
- [ ] `components/novel/NovelWorkspace.tsx`（新，FE-05）：四态视图机（workbench 常驻挂载 hidden 切换；advanced/archives 懒挂载离开卸载）；ProContainer 包 phase 子树（TabProgressButton/GateBanner/OnboardingCard/useNovelState → ProPhaseSurface）；DeleteConfirmModal；默认落点 workbench
- [ ] `pages/NovelPage.tsx`（退役，FE-05）：删除文件
- [ ] `App.tsx`（改造，FE-06）：`/novel/:id` 单 index → NovelWorkspace；删 10 条死子路由；移除 NovelPage import

## 测试（TE-16 / TE-28 / TE-29 / TE-17 + FE-34）

- [ ] `src/__tests__/useChapterData.test.tsx`（TE 配套）：1.5s 防抖自动保存；四态流转；失败重试；countChars；卸载 flush
- [ ] `src/__tests__/NovelWorkspace.test.tsx`（TE-16）：默认 workbench；切走再回 prose 不丢；advanced 懒挂载离开卸载
- [ ] `src/__tests__/WritingTree.test.tsx`（TE-28）：常驻 + 新建卷/章；新章即达编辑器；空章「未写」弱化；hover CRUD；字数/归档徽标
- [ ] `src/__tests__/ProContainer.test.tsx`（TE-29）：免费态无 phase-status 请求、无 GateBanner/OnboardingCard；PRO 态渲染
- [ ] `e2e/free-writing-flow.spec.ts`（FE-34 / TE-17）：建书即写 → 树 CRUD → 新建章即达编辑器 → 自动保存 → 字数/进度 → 归档只读 → 无 AI 字段与提示词 → 免费 AI 端点 403 → 免费归档不 500

## 验收

- [ ] `cd client/frontend && npx tsc --noEmit` 通过
- [ ] `cd client/frontend && npx vitest run` 新增单测绿（含既有 16）
- [ ] `cd client/frontend && npx playwright test` 免费主流程 E2E 绿（若 Docker :80 可用；否则本地 mock SERVER_API_BASE）
- [ ] P0 断点 1（sprint-plan §4.1 全部 8 条）覆盖：建书即写 / +新建卷章即达编辑器 / 树 CRUD + 空章弱化 / 抽屉 + 目标字数 / textarea 自动保存 + 字数 + 四态重试 / 归档只读 + 树 📦 + 不 500 / 「高级配置 ▾」N3 / 全程无阶段催促 + 无 AI 字段 + 免费 AI 403
