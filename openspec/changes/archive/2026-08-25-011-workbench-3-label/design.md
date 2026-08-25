# 011-workbench-3-label — Design

## 架构总览

```
NovelWorkspace
├── NovelBar                       # 顶栏：书名 + tier badge + 删除（「高级配置 ▾」退役）
├── 3 label 导航（ProContainer 外，两态共用，纯导航无徽标）
│    编辑设定 → AdvancedSettingsView
│    编辑正文 → Workbench
│    预览小说 → ArchivePage
├── ProContainer → ProPhaseSurface  # 仅 GateBanner + OnboardingCard + useNovelState（N14 免费零请求）
└── Workbench（常驻挂载，hidden 切换保 prose 脏状态/光标）
    ├── WritingTree                # 左树（useWorkbench / GET /volumes）
    ├── 章选中 → 中部子 label：正文 / 章纲 / 提示词
    │    正文   → ChapterEditor + RightToolbar
    │    章纲   → useOutline.loadChapterData → OutlineEditor
    │    提示词 → TierGate("prompt-panel") → PromptManagementPage(chapterRef)
    ├── 卷选中 → 右侧抽屉（VolumeEditor，遮罩/Esc/关闭）
    └── ChapterStatusBar
```

## 关键实现点

### 1. NovelWorkspace：3 label + 视图收敛

- `WorkspaceView`：4 值 → 3 值（删 `"advanced-outline"`）。
- TABS 由 `ProPhaseSurface`（ProContainer 内）**上移**到 ProContainer 外——免费/PRO 共用同一批 3 个 `TabProgressButton`（`status` 不传 → 纯导航无徽标）。
- `useNovelState` 仍在 ProContainer 内 → 免费态零 phase-status 请求（N14）不变。
- `AdvancedOutlineView` 整块移除（其 `OutlineEditor`/`useOutline` 依赖移入 Workbench）。

### 2. Workbench：章子 label + 卷抽屉

- 状态：`activeTab: "prose"|"outline"|"prompt"`、`drawerVol: string|null`、`lastDrawerVolRef`。
- **卷抽屉开合**：
  - `handleSelectNode` 包装 `onSelectNode`：点卷 → `setDrawerVol(vol)`；点章 → 关抽屉 + `setActiveTab("prose")`。
  - 效果监听 `selectedId`：`createVolume` 路径仅对新卷首次出现开抽屉；手动关闭（遮罩/Esc/关闭按钮）不重开同一卷（`lastDrawerVolRef` 防抖）。
  - 抽屉实现（库内无 daisyUI drawer 先例，取 Mode C 变体）：`fixed inset-0 z-50 bg-black/50` 遮罩 + `fixed right-0 top-0 bottom-0 z-50 w-[400px]` 面板；Esc 全局监听关闭。
- **章子 label**：`selectedRef` 时渲染 3 个 `TabProgressButton`。正文 → 原 `ChapterEditor`+`RightToolbar`；章纲 → `ChapterOutlinePanel`（`useOutline.loadChapterData` 按需加载 + 加载/错误态 + `OutlineEditor`）；提示词 → `<TierGate feature="prompt-panel">` 包按钮与内容。
- **两棵树不冲突**：`useWorkbench`(GET /volumes) 与 `useOutline`(GET /tree) 各自持有，章纲数据按需 `loadChapterData`，无强制同步。

### 3. ChapterEditor：移除内部 正文/提示词 tabs

- 删 `viewTab`/`promptText` 状态、`loadPrompt`/`handleCopyPrompt`、`TabBar` 与 `viewTab === "prompt"` 块——提示词统一由子 label → `PromptManagementPage` 承担。
- 副作用：堵住免费态经内部提示词 tab 查看提示词的泄漏（原 TabBar 无 TierGate）。
- 清理孤儿 import：`getToken`、`getApiBaseUrl`、`Copy`、`TabBar`。

### 4. PromptManagementPage：chapterRef 过滤

- props 加可选 `chapterRef?: string`；`visibleChapters = chapterRef ? volumes 过滤 : 全部`。
- 加载 effect 与 overview 渲染都用 `visibleChapters`；传入时自动展开该章卡片。
- 自身不包 TierGate（由 Workbench 调用处包）。

### 5. NovelBar / EmptyState 简化

- NovelBar 删 3 个 nav props 与整个 `isFree &&` 下拉块，保留书名/层级标识/删除。
- EmptyState 删 `onGoAdvanced`/`hideAdvanced` 与「高级配置」按钮，保留 创建第一卷 / 直接写第一章。

## 测试

- `NovelWorkspace.test.tsx`：3 label 断言（两态）、免费空项目无章子 label、免费选中章 正文/章纲 + 提示词不可见、PRO 选中章 提示词可见、卷抽屉相关不新增（E2E 覆盖）、零 phase-status 断言保留。
- `free-writing-flow.spec.ts`：`openAdvanced` helper 删除 → 点「编辑设定」label；卷节点点击断言改「抽屉出现 + Esc 关闭」。
- `creation-flow.spec.ts`：两处进设定改点「编辑设定」。

## 风险与取舍

- **免费空项目子 label**：章选中才渲染 正文/章纲/提示词，免费空项目无章 → E2E 断言「无「正文」按钮」语义同步为「无章子 label」。
- **两棵树**：章节创建后 outline 树不自动刷新，由章纲子 label 按需 `loadChapterData` 覆盖。
- **抽屉遮罩**：覆盖全屏（含 3 label 导航），关闭需点遮罩/Esc/关闭按钮——标准 modal 交互，符合「点卷弹抽屉」心智。
