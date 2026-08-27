# 011-workbench-3-label — Tasks

## FE-01 NovelWorkspace：3 label + 视图收敛
- [x] `useWorkbench.ts`：`WorkspaceView` 4→3（删 `advanced-outline`）
- [x] `NovelWorkspace.tsx`：3 label 导航（编辑设定/编辑正文/预览小说）上移 ProContainer 外，两态共用纯导航无徽标
- [x] `NovelWorkspace.tsx`：删除 `AdvancedOutlineView` 整块 + 相关 import

## FE-02 Workbench：章子 label + 卷抽屉
- [x] `Workbench.tsx`：props 收敛为 `{ wb }`（删 `onGoAdvancedSettings`/`onGoAdvancedOutline`）
- [x] `Workbench.tsx`：`activeTab`(正文/章纲/提示词) + `drawerVol` 状态；`handleSelectNode` 点卷弹抽屉、点章关抽屉
- [x] `Workbench.tsx`：`useOutline` 挂载；`ChapterOutlinePanel` 按需 `loadChapterData` → `OutlineEditor`（含加载/错误态）
- [x] `Workbench.tsx`：提示词子 label → `<TierGate feature="prompt-panel">` 包按钮与 `PromptManagementPage(chapterRef)`
- [x] `Workbench.tsx`：卷抽屉 Mode C（遮罩 + 400px 右面板 + 关闭按钮 + Esc）

## FE-03 ChapterEditor：移除内部 正文/提示词 tabs
- [x] `ChapterEditor.tsx`：删 `viewTab`/`promptText`/`loadPrompt`/`handleCopyPrompt`/`TabBar`/`viewTab==="prompt"` 块
- [x] `ChapterEditor.tsx`：清理孤儿 import（`getToken`/`getApiBaseUrl`/`Copy`/`TabBar`）

## FE-04 PromptManagementPage：chapterRef 过滤
- [x] `PromptManagementPage.tsx`：props 加 `chapterRef?`；`visibleChapters` 过滤加载与渲染；自动展开该章

## FE-05 NovelBar / EmptyState 简化
- [x] `NovelBar.tsx`：删「高级配置 ▾」下拉与 3 个 nav props（保留书名/tier badge/删除）
- [x] `EmptyState.tsx`：删「高级配置」按钮与 `onGoAdvanced`/`hideAdvanced`

## FE-06 测试同步
- [x] `NovelWorkspace.test.tsx`：3 label 断言两态；新增「免费选中章 正文/章纲 + 提示词不可见」「PRO 选中章 提示词可见」
- [x] `free-writing-flow.spec.ts`：删 `openAdvanced` → 点「编辑设定」；卷点击改「抽屉 + Esc 关闭」
- [x] `creation-flow.spec.ts`：两处进设定改点「编辑设定」

## FE-07 回归
- [x] `tsc --noEmit` ✓
- [x] `vitest run` 51 passed
- [x] `npm run build` ✓
- [x] `playwright test --list` 编译通过（24 用例 / 3 spec）
- [x] `openspec validate 011-workbench-3-label --type change` → valid
