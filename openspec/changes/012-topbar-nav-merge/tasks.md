# 012-topbar-nav-merge — Tasks

## FE-01 TabProgressButton 样式
- [x] active：`bg-primary text-primary-content` → `bg-base-300 text-base-content font-medium`
- [x] inactive 无 status：`text-base-content/30` → `/60` + hover

## FE-02 NovelBar 吸收 3 label
- [x] props `{ view, onNavigate, onDelete }`；左组 `flex-1 min-w-0`（书名截断 + nav `shrink-0`）+ 右簇 `shrink-0`
- [x] 3 label 并入标题行（编辑设定/编辑正文/预览小说）

## FE-03 NovelWorkspace 收敛
- [x] 删 3-label 行，改 `NovelBar view={view} onNavigate={go}`
- [x] `AdvancedSettingsView` 删头部行（设定+返回正文）+ `onBack` prop + `ArrowLeft` import；根节点 `flex-col h-full` → `flex h-full`

## FE-04 Workbench 上下文行
- [x] 面包屑 + 章子 label（正文/章纲/提示词，提示词 TierGate）+ 专注开关并为一行
- [x] 删独立章子 label 行

## FE-05 ArchivePage
- [x] 删「返回项目 + 归档 N章」头部行；`归档 (N章)` 下沉为内容标题
- [x] 删 `ArrowLeft` import；`onBack` 保留（空态 + 阅读器）

## FE-06 测试同步
- [x] `NovelWorkspace.test.tsx`：两处「返回正文」→ 经「编辑正文」label 返回
- [x] `free-writing-flow.spec.ts`：进设定断言改「世界设定」+ 「编辑正文」返回

## FE-07 回归
- [x] `tsc --noEmit` ✓
- [x] `vitest run` 51 passed
- [x] `npm run build` ✓
- [x] `playwright test --list` 24 用例编译通过
- [x] `openspec validate 012-topbar-nav-merge --type change` → valid
