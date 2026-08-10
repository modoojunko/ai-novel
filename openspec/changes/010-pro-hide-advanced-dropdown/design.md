# 010-pro-hide-advanced-dropdown — Design

## 架构总览

```
NovelWorkspace
├── NovelBar            # isFree 才渲染「高级配置 ▾」下拉（免费态专属入口）
├── ProContainer        # PRO 态透传 → ProPhaseSurface 阶段 tabs（设定/大纲/正文/归档）
└── Workbench / advanced-* / archives   # 四态视图
```

入口分工：
- **免费态**：无阶段 tabs（ProContainer 裁掉）→ 下拉是设定/大纲/归档唯一入口。
- **PRO 态**：阶段 tabs 承担四态 → 下拉隐藏，避免重复。

## 关键实现点

### 1. NovelBar.tsx 条件渲染

```tsx
{isFree && (
  <div className="dropdown dropdown-end"> … 高级配置 ▾ … </div>
)}
```

- `useTier()` 已有 `isFree`，直接使用；「可选」badge 此前已仅免费显示，随块内移。
- 删除按钮（Trash2）保持在条件块外，免费/PRO 都渲染。

### 2. NovelWorkspace.test.tsx PRO 断言

在 PRO describe 块新增用例：阶段 tabs 四按钮存在 + `queryByTitle("高级配置（设定/大纲）")` 为 null。

### 3. EmptyState 引导区按钮（hideAdvanced）

```tsx
// EmptyState.tsx
{!hideAdvanced && (
  <button title="设定/大纲（可选）">… 高级配置 …</button>
)}
// Workbench.tsx
const { isFree } = useTier();   // 新增
<EmptyState … hideAdvanced={!isFree} />
```

- EmptyState 只在空项目树时渲染，免费/PRO 都显示引导区；PRO 态阶段 tabs 已在上方，隐藏该按钮避免第三处重复。

### 4. creation-flow.spec.ts PRO 用例改入口

- 「简介空不可完成设定」（AC-4.2）：`openAdvanced(page, "设定")` → `page.getByRole("button", { name: /设定/ }).click()`（阶段 tab）。
- 「设定 7 项全确认」：同上。
- 删除 `openAdvanced` helper（本文件无剩余引用；`free-writing-flow.spec.ts` 仍有独立实现，保留）。

### 5. free-writing-flow.spec.ts 选择器去歧义

免费态空项目时 NovelBar 下拉与 EmptyState 按钮文本都是「高级配置」，`getByRole("button", { name: "高级配置", exact: true })` 匹配 2 个 → Playwright strict mode 报错。改为 `getByTitle("高级配置（设定/大纲）")`（NovelBar 按钮 title；EmptyState title 是「设定/大纲（可选）」），`openAdvanced` 与断言同改。

## 退役/删除

- `creation-flow.spec.ts` 的 `openAdvanced` helper（孤儿代码）。

## 测试

- 见 spec.md ADDED Requirements（PRO 隐藏 / 免费保留 / EmptyState hideAdvanced / E2E 适配）。

## 风险与取舍

- **免费态回归面**：`free-writing-flow.spec.ts` 全程走下拉（改精确选择器，行为不变）；本地手动验证免费态下拉与 EmptyState 按钮都在。
- **阶段 tab「设定」可命中**：`getByRole("button", { name: /设定/ })` 非 exact，带 ✓/动画图标也能匹配；PRO 用例无「高级配置」按钮，不会二义。
