# 工作台 3 Label 重构（011-workbench-3-label）

## Why

小说工作台入口冗余、大纲管理散落两处、提示词入口丢失：

1. **双套大纲管理**：PRO 阶段 tabs 的「大纲」打开 `AdvancedOutlineView`（自己的 `useOutline` 树），与「正文」工作台的 `WritingTree`（`useWorkbench`）管同一批卷章，重复且相互不同步。
2. **入口混乱**：免费态靠 NovelBar「高级配置 ▾」下拉进入设定/大纲/归档；PRO 靠阶段 tabs。用户反馈「大纲 label 可以不要了」「正文 label 下的左侧树才是大纲管理」「树点节点弹抽屉没了」「内容堆在正文中间」。
3. **提示词入口丢失**：`PromptManagementPage` 是孤儿组件（无任何调用方），用户无法按当前章查看/生成/编辑提示词。

## What Changes

统一 **3 个 label**（两态共用，纯导航无状态徽标）：

1. **编辑设定** = 所有设定（现 `AdvancedSettingsView`）。
2. **编辑正文** = 大纲 + 正文 + 提示词（现 `Workbench` 扩展）。
3. **预览小说** = 归档预览（现 `ArchivePage`）。

树交互（011 核心）：

- 点**卷**节点 → 弹**右侧抽屉**（卷纲编辑，复用 `VolumeEditor`，遮罩/Esc/关闭按钮退出）。
- 点**章**节点 → 中部子 label 切换 **正文 / 章纲 / 提示词**：
  - 正文 → `ChapterEditor` + `RightToolbar`（不变）。
  - 章纲 → `OutlineEditor`（复用自包含表单，数据经 `useOutline.loadChapterData` 按需加载）。
  - 提示词 → `PromptManagementPage`（加 `chapterRef` 过滤为当前章），**PRO-only**（`TierGate feature="prompt-panel"` 门控按钮与内容），含生成按钮 + 人工编辑。
- 「大纲」label 不再单独存在；`AdvancedOutlineView` 整块移除；NovelBar「高级配置 ▾」下拉退役；EmptyState「高级配置」按钮退役。
- `ChapterEditor` 内部旧 正文/提示词 tabs 移除（提示词改由子 label 承担，同时堵住免费态经内部 tab 查看提示词的泄漏）。

## Impact

- 前端修改：`NovelWorkspace.tsx`、`Workbench.tsx`、`ChapterEditor.tsx`、`NovelBar.tsx`、`EmptyState.tsx`、`PromptManagementPage.tsx`、`useWorkbench.ts`（`WorkspaceView` 4→3）。
- 测试：`NovelWorkspace.test.tsx`、`e2e/free-writing-flow.spec.ts`、`e2e/creation-flow.spec.ts`。
- 无后端改动。

## Rollout

1. `NovelWorkspace` 3 label + 删 advanced-outline 视图 + TABS 移出 ProContainer
2. `Workbench` 章子 label（正文/章纲/提示词）+ 卷抽屉
3. `PromptManagementPage` chapterRef 过滤 + `ChapterEditor` 旧 tabs 移除
4. `NovelBar` / `EmptyState` 简化
5. 测试同步 + 新增子 label 断言
6. 回归：`tsc --noEmit` + `vitest run` + `npm run build` + E2E spec 编译
7. `openspec validate 011-workbench-3-label --type change`
