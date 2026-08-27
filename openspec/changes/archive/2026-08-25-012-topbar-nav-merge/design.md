# 012-topbar-nav-merge — Design

## 架构总览

```
NovelBar（唯一顶栏，40px）
├── 左组（flex-1 min-w-0）── 书名（flex 截断 ≤30vw）+ 3 label（shrink-0 永不截断）
└── 右簇（shrink-0）── 档位 badge + 删除

视图内容
├── 编辑正文 → Workbench
│    └── 上下文行（36px）：面包屑 + 章子 label（正文/章纲/提示词）+ 专注开关
└── 编辑设定 → AdvancedSettingsView（头部行已删，设定树直接接顶栏）
└── 预览小说 → ArchivePage（头部行已删，归档 (N章) 为内容标题）
```

## 关键实现点

### 1. TabProgressButton：active 中性药丸 / inactive 可点

- active：`bg-primary text-primary-content` → `bg-base-300 text-base-content font-medium`。primary 色回归给 PRO badge（badge-primary）与主 CTA，避免「当前模式」与「付费身份」抢层级。
- inactive 无 status：`text-base-content/30` → `text-base-content/60`（phase-progress 语义「pending 灰态」放导航上读成禁用，提亮 + hover 给可点暗示）。
- 全库现有使用点（NovelBar 3 label + Workbench 3 章子 label）均为纯导航，改默认安全。

### 2. NovelBar：吸收 3 label

- props：`{ view: WorkspaceView, onNavigate, onDelete }`。`WorkspaceView` 类型自 `useWorkbench` 导入。
- 结构：容器 `flex items-center gap-2 px-4 py-1.5` → 左组 `flex-1 min-w-0`（内：书名 div `min-w-0` + nav `shrink-0`）+ 右簇 `shrink-0`。
- 截断规则：书名 `max-w-[30vw] truncate`（既有 h1 约束）物理上碰不到 label；任何宽度下 3 label 完整可点、不换行。

### 3. NovelWorkspace：删 3-label 行 + 设定头部行

- 3 label 行（011 引入）整块移除，改由 `NovelBar view={view} onNavigate={go}` 承担。
- `AdvancedSettingsView`：删「设定 + 返回正文」头部行 → 根节点 `flex flex-col h-full` 简化为 `flex h-full overflow-hidden`；删 `onBack` prop、调用处、`ArrowLeft` import。

### 4. Workbench：上下文行合并

- 面包屑行（`flex items-center border-b bg-base-100/60`）内，`selectedRef` 时追加：章子 label div（`shrink-0 px-2`，提示词仍 `TierGate("prompt-panel")`）+ 专注开关按钮。
- 原独立章子 label 行（`px-3 py-1 border-b`）整块移除。专注模式/卷抽屉/子 label 功能不变。

### 5. ArchivePage：头部行删除 + 计数下沉

- 删「返回项目 + 归档 N章」头部行（`mb-5`）；`归档 (N章)` 以 `Archive` 图标 + `h2` + `badge` 下沉为内容标题（`mb-4`）置于搜索栏上方。
- `onBack` 保留（空态「回到正文」+ 阅读器「返回列表」仍用）；`ArrowLeft` import 删除。

## 测试

- `NovelWorkspace.test.tsx`：两处依赖「返回正文」按钮的用例改为经顶栏「编辑正文」label 返回（断言设定树卸载）。
- `e2e/free-writing-flow.spec.ts`：进设定断言改「世界设定 可见」，返回改点「编辑正文」。

## 风险与取舍

- **窄窗口**：书名 `flex-1` 截断让位、3 label `shrink-0` 保整；免费 badge（全排最宽 ~190px）在 <1024px 仍可能挤压书名，本轮仅靠截断兜底，未做免费 badge 缩写（如需再降级）。
- **TabProgressButton 默认样式变更**：若未来 phase-progress UI 回归需独立强调，再加 `variant="nav"` prop（YAGNI，当前两处均 nav）。
- **设定/归档返回路径**：删除「返回正文/返回项目」按钮后，返回统一走顶栏「编辑正文」label——两处内容级导航（空态 CTA / 阅读器返回列表）保留。
