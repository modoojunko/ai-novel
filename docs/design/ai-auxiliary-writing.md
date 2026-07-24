# AI 辅助写作 — 续写/润色/扩写 UI 设计规范

> 对应 Issue: #39  
> 设计系统版本: v1.0  
> UI Designer: AI Novel Design System  
> 日期: 2026-07-24  
> 主题: novelforge (dark) / parchment (light)  
> 组件库: daisyUI 4 + Tailwind CSS 3 + React 19

---

## 目录

1. [交互设计总览](#1-交互设计总览)
2. [交互 1: 续写 (Continue)](#2-交互-1-续写-continue)
3. [交互 2: 润色 (Polish)](#3-交互-2-润色-polish)
4. [交互 3: 扩写 (Expand)](#4-交互-3-扩写-expand)
5. [组件清单](#5-组件清单)
6. [状态机: 预览-接受-拒绝 生命周期](#6-状态机-预览-接受-拒绝-生命周期)
7. [选区追踪方案](#7-选区追踪方案)
8. [边界情况与容错](#8-边界情况与容错)
9. [实现注意事项](#9-实现注意事项)

---

## 1. 交互设计总览

### 1.1 入口位置

三个功能入口位于 `RightToolbar` 组件的已有 "AI 写作" 区块中（`client/frontend/src/components/novel/RightToolbar.tsx`）：

```
┌─────────────────────────────┐
│  AI 写作                     │
│  ┌─────────────────────────┐ │
│  │ 从当前光标位置继续写作    │ │
│  └─────────────────────────┘ │
│  ┌─────────────────────────┐ │
│  │ ✨ 继续写作              │ │ ← 续写按钮（不使用选区）
│  └─────────────────────────┘ │
│  ┌──────────┐ ┌──────────┐ │ │
│  │ 🔄 润色  │ │ 📖 扩写  │ │ │ ← 润色/扩写按钮（依赖选区）
│  └──────────┘ └──────────┘ │ │
└─────────────────────────────┘
```

### 1.2 三种交互对比

| 维度 | 续写 (Continue) | 润色 (Polish) | 扩写 (Expand) |
|------|----------------|---------------|---------------|
| **触发** | 光标位置（无选区） | 选中文本 | 选中文本 |
| **交互模式** | 流式 (SSE) | 非流式 (请求-响应) | 非流式 (请求-响应) |
| **结果展示** | 内联追加 + 闪烁光标 | 对比预览弹窗 | 对比预览弹窗 |
| **确认方式** | 自动保存（可手动停止） | Accept / Reject / Retry | Accept / Reject / Retry |
| **预览必要性** | 不预览（直接写入） | 必须预览 | 必须预览 |

### 1.3 按钮行为矩阵

```
                    ┌──────────┬──────────┬──────────┐
                    │  续写     │  润色     │  扩写     │
├──────────┼──────────┼──────────┤
│ 无选区     │ 可用      │ 置灰+提示  │ 置灰+提示  │
│ 有选区     │ 可用      │ 可用      │ 可用      │
│ 请求中     │ 停止按钮  │ Spinner  │ Spinner  │
│ 结果预览   │ N/A      │ 对比窗    │ 对比窗    │
│ 完成       │ 已保存    │ 已替换    │ 已替换    │
└──────────┴──────────┴──────────┘
```

---

## 2. 交互 1: 续写 (Continue)

### 2.1 用户操作流

```
1. 光标放在编辑器正文中想要续写的位置
       │
2. 点击 RightToolbar "继续写作" 按钮
       │
3. AI 从光标位置开始 SSE 流式输出
       │
   ┌────┴────┐
   │ 用户操作 │
   └────┬────┘
        │
   ┌────┴────┐
   │ 等待完成 │──── 停止按钮 ────▶ 保留已流式内容 + 触发保存
   └────┬────┘
        │
   ┌────┴────┐
   │ 完成    │──── 触发自动保存
   └─────────┘
```

### 2.2 状态变化

| 状态 | 编辑器显示 | 按钮显示 | 自动保存 |
|------|-----------|---------|---------|
| **Idle** | 普通 textarea | "继续写作" | 3s 防抖 |
| **Streaming** | 流式文本 + 闪烁光标 | "⏹ 停止" (红色) | 暂停 |
| **Completed** | prose 已包含流式内容 | "继续写作" | 立即保存 |
| **Stopped** | prose 已包含已流式内容 | "继续写作" | 立即保存 |
| **Error** | prose 保留 | "继续写作" + 错误提示 | 不保存 |

### 2.3 UI 细节

**复用已有模式** — 完全复用 ChapterEditor 中已有的 SSE 流式写入模式（`handleStartWriting`/`handleStopWriting` 函数和闪烁光标 CSS），不需要新 UI 组件。

**关键区别**: 续写从光标位置插入，而不是替换整个正文。

**功能拆分建议**: 将现有 `handleStartWriting` 重命名为 `handleFullWrite`，新增 `handleContinueWriting` 使用新的 `/write/continue` 端点。

### 2.4 光标位置追踪

**方案**: 在 textarea 的 `onMouseUp` / `onKeyUp` 时记录 `selectionStart`，保存到 ref 中。

```typescript
// 在 ChapterEditor 中新增
const cursorPositionRef = useRef<number>(0);

// textarea 事件
const handleCursorMove = (e: React.MouseEvent | React.KeyboardEvent) => {
  const target = e.target as HTMLTextAreaElement;
  cursorPositionRef.current = target.selectionStart;
};

// 续写逻辑
const handleContinueWriting = () => {
  const pos = cursorPositionRef.current;
  // 发送 pos 到后端，从该位置追加
  streamContinueWrite(projectId, chapterRef, pos, {
    onChunk: (text) => {
      setProse(prev => prev.slice(0, pos) + prev.slice(pos) + text);
      // 实际上 streamContinueWrite 返回的是完整文本，由后端决定
    }
  });
};
```

> **注意**: 续写的实现方式可能有两种：
> 1. 前端在光标位置插入流式文本（拼合）
> 2. 后端返回完整 prose（简单但每次重新传输全文）
> 
> 建议方案 2（后端返回完整 prose），与 `onDone(fullText)` 现有回调一致。

---

## 3. 交互 2: 润色 (Polish)

### 3.1 用户操作流 (核心设计)

```
1. 用户在 textarea 中选中一段文本
       │
2. 选区被锁定 (mousedown 时捕获)
   → RightToolbar 润色按钮变为可用
       │
3. 用户点击 "润色"
       │
4. 按钮变为 loading → "AI 优化中…"
   → 调用 /write/polish API (非流式)
       │
5. API 返回润色结果
       │
6. 打开 ContrastPreviewModal
   ┌─────────────────────────────────────┐
   │ 左: 原文      │ 右: 润色后         │
   │─────────────────────────────────────│
   │ 选中的段落内容  │ AI 改写后的内容    │
   │               │                    │
   │  [拒绝] [换一个] [接受]             │
   └─────────────────────────────────────┘
       │
   ┌────┴────┐
   │ 用户选择 │
   └────┬────┘
        │
   ┌────┴────────┐
   │ 接受 → 替换原文中选中的部分
   │         → 显示 "已替换" toast (3s)
   │         → 可 Ctrl+Z 撤销 (undo stack)
   ├──────────────┤
   │ 拒绝 → 关闭弹窗，原文不变
   ├──────────────┤
   │ 换一个 → 重新调用 API
   │          → loading → 更新右侧预览
   └─────────────┘
```

### 3.2 对比预览弹窗 (ContrastPreviewModal)

这是润色/扩写共享的核心组件。

**布局**: 水平分栏（桌面） / 垂直堆叠（移动端）

```
┌──────────────────────────────────────────────────────┐
│ ✨ AI 润色建议                    [X] 关闭            │
│                                                        │
│  ┌─────────────────────┬─────────────────────────────┐ │
│  │ 原文                 │ 润色后                      │ │
│  │ (Original)           │ (Polished)                  │ │
│  │                       │                             │ │
│  │ 他走过了那条街，       │ 他缓步穿过那条幽静的街道，     │ │
│  │ 看到了一个奇怪的       │ 目光被一间散发着暖黄色        │ │
│  │ 小店。                │ 灯光的小店吸引。              │ │
│  │                       │                             │ │
│  │  (字体: 衬线 大小)     │  (字体: 衬线 大小)           │ │
│  └─────────────────────┴─────────────────────────────┘ │
│                                                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  [❌ 拒绝]    [🔄 换一个]    [✅ 接受]             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                        │
│  < 提示: 润色会改进表达方式，不改变核心意思 >             │
└──────────────────────────────────────────────────────┘
```

**设计要点**:
- 左右分栏完全对称，视觉上无法区分"哪个是改前哪个是改后"是大忌
- 左侧顶部标 "原文 (Original)" 用灰色标签，右侧 "润色后 (Polished)" 用琥珀色标签
- 两栏文本同步滚动（同一滚动容器或联动 scroll）
- 右侧文本增加浅琥珀色左侧竖线装饰（`border-l-2 border-l-amber-400/40`）以强化"这是 AI 改过的"
- 行数差异大时保持各自独立滚动

**移动端 (窄屏幕)**: 切换为垂直分栏，原文在上，修改文在下，中间用分隔线。

```css
/* 水平分栏容器 */
.contrast-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .contrast-preview {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }
}
```

### 3.3 状态变化

| 状态 | RightToolbar 按钮 | 编辑器 | ContrastPreviewModal | API 状态 |
|------|------------------|--------|---------------------|---------|
| **Idle (无选区)** | 置灰 + tooltip "请先选中文字" | 正常编辑 | 关闭 | - |
| **Idle (有选区)** | 正常高亮 | 有蓝色选中高亮 | 关闭 | - |
| **Loading** | Spinner + "AI 优化中…" | 保持不变（用户不可编辑） | loading 骨架屏 | 请求中 |
| **Preview** | "润色" 还原 | 保持不变 | 显示对比 | 已完成 |
| **Accepted** | "润色" 还原 | 选中文本已被替换 | 关闭 | - |
| **Rejected** | "润色" 还原 | 保持不变 | 关闭 | - |
| **Error** | "润色" 还原 | 保持不变 | 关闭 + 错误 toast | 失败 |

### 3.4 润色 vs 扩写差异

| 特征 | 润色 | 扩写 |
|------|------|------|
| 输出长度 | 与原选文相近 | 明显更长（2-3倍） |
| 右侧标签 | "润色后 (Polished)" | "扩写后 (Expanded)" |
| 弹窗标题 | "AI 润色建议" | "AI 扩写建议" |
| 指导文字 | "润色会改进表达方式，不改变核心意思" | "扩写会丰富细节描写，保留核心信息" |

---

## 4. 交互 3: 扩写 (Expand)

### 4.1 用户操作流

与润色完全一致，区别仅在于调用的 API 端点和预览展示方式。

```
1. 选中短文本段落
2. 点击 "扩写"
3. loading → API 调用
4. 打开 ContrastPreviewModal (标题: "AI 扩写建议")
5. 右侧展示明显更长的版本
6. Accept / Reject / Retry
```

### 4.2 设计要点

- 扩写结果通常较长，预览弹窗高度应自适应（max-h 可滚动）
- 两侧文本可能长度差异大，同步滚动时保持行对齐无意义，采用独立滚动
- 在右侧预览顶部增加字数统计：`扩写前: 45 字 → 扩写后: 186 字`

---

## 5. 组件清单

### 5.1 RightToolbar 按钮改造

**文件**: `client/frontend/src/components/novel/RightToolbar.tsx`

```tsx
// 新增 props 接口
interface RightToolbarProps {
  projectId: string;
  chapterRef: string;
  // 新增 — 与 ChapterEditor 共享状态
  hasSelection: boolean;
  selectedText: string;
  onContinue: () => void;
  onPolish: () => void;
  onExpand: () => void;
  // 状态
  continueLoading: boolean;
  polishLoading: boolean;
  expandLoading: boolean;
}
```

**按钮组件设计**:

```tsx
// 续写按钮 — 始终可用
<ButtonContinue onClick={onContinue} loading={continueLoading} />

// 润色按钮 — 受选区状态控制
<ButtonPolish 
  onClick={onPolish} 
  loading={polishLoading} 
  disabled={!hasSelection}
  tooltip={!hasSelection ? "请先选中文字" : undefined}
/>

// 扩写按钮 — 受选区状态控制  
<ButtonExpand 
  onClick={onExpand} 
  loading={expandLoading}
  disabled={!hasSelection}
  tooltip={!hasSelection ? "请先选中文字" : undefined}
/>
```

### 5.2 Interface: AISelectionCapture

用于连接 ChapterEditor 和 RightToolbar 的选区状态契约。

```typescript
// client/frontend/src/lib/selection.ts

export interface SelectionCapture {
  /** 选区起始位置 (textarea.selectionStart) */
  start: number;
  /** 选区结束位置 (textarea.selectionEnd) */
  end: number;
  /** 选中的文本内容 */
  text: string;
  /** 完整的当前 prose */
  fullText: string;
}

/**
 * 在 mousedown 时锁定选区。
 * 这是解决"点击按钮时选区丢失"问题的关键。
 */
export function captureSelection(textarea: HTMLTextAreaElement | null): SelectionCapture | null {
  if (!textarea) return null;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start === end) return null; // 无选区
  return {
    start,
    end,
    text: textarea.value.slice(start, end),
    fullText: textarea.value,
  };
}
```

### 5.3 ContrastPreviewModal

**文件**: `client/frontend/src/components/novel/ContrastPreviewModal.tsx`

```tsx
interface ContrastPreviewModalProps {
  /** 是否显示 */
  open: boolean;
  /** 模式: polish | expand */
  mode: "polish" | "expand";
  /** 原文选中文本 */
  originalText: string;
  /** AI 修改后的文本 */
  modifiedText: string;
  /** 是否正在加载 */
  loading: boolean;
  /** 接受 */
  onAccept: () => void;
  /** 拒绝 */
  onReject: () => void;
  /** 重新生成 */
  onRetry: () => void;
  /** 关闭 */
  onClose: () => void;
}
```

**状态表**:

| `open` | `loading` | 渲染内容 |
|--------|-----------|---------|
| `false` | - | 不渲染 |
| `true` | `true` | 骨架屏 + spinner + "AI 正在优化…" |
| `true` | `false` | 对比预览 + 操作按钮 |
| `true` | `false` (error) | 错误提示 + [重试] [关闭] |

**按键绑定**:
- `Enter` — 接受 (Accept)
- `Escape` — 拒绝/关闭 (Reject)
- `r` — 重新生成 (Retry)

### 5.4 ActionBar 子组件

操作栏复用设计:

```tsx
interface ActionBarProps {
  onAccept: () => void;
  onReject: () => void;
  onRetry: () => void;
  acceptLabel?: string;  // 默认 "接受"
  rejectLabel?: string;  // 默认 "拒绝"
  retryLabel?: string;   // 默认 "换一个"
}
```

**视觉设计**:
- 拒绝按钮: `btn btn-ghost` 灰色，左对齐
- 换一个按钮: `btn btn-outline` 带刷新图标，居中
- 接受按钮: `btn btn-primary` 琥珀色主色调，右对齐

```
[❌ 拒绝]          [🔄 换一个]          [✅ 接受]
< ghost / gray      outlined              primary amber >
```

### 5.5 SelectionGuard 组件

文字提示组件，用于当用户点击润色/扩写但未选中文本时。

```tsx
// 内联在按钮下方，或作为 tooltip
function SelectionGuard({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="text-[10px] text-amber-500/70 mt-1 flex items-center gap-1">
      <span>⚠</span>
      <span>请先选中文字</span>
    </div>
  );
}
```

### 5.6 EdgeCaseBanner (新)

当用户选中了不适合处理的文本时（如标题、空选区），在编辑器顶部显示警告横幅。

```tsx
interface EdgeCaseBannerProps {
  type: "no-selection" | "too-long" | "contains-headers" | "api-error";
  onDismiss: () => void;
}
```

> 实现时注意: 目前最简单的方案是直接在 toast 中显示这些信息，不需要独立组件。

---

## 6. 状态机: 预览-接受-拒绝 生命周期

### 6.1 润色/扩写状态机

```
                    ┌─────────────────────┐
                    │   IDLE (无选区)      │
                    │   按钮灰色 + tooltip  │
                    └─────────┬───────────┘
                              │ 用户选中文本
                              ▼
                    ┌─────────────────────┐
                    │   IDLE (有选区)      │ ←── 选区变化时重置
                    │   按钮可用           │
                    └─────────┬───────────┘
                              │ 点击按钮 (trigger via mousedown-locked selection)
                              ▼
                    ┌─────────────────────┐
                    │   LOADING           │ ←── 选区在此时锁定
                    │   spinner + 占位     │
                    │   "AI 正在优化…"      │
                    └─────────┬───────────┘
                              │ API 返回
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
          ┌──────────────────┐  ┌──────────────────┐
          │   PREVIEW         │  │   ERROR           │
          │  对比展示          │  │  "优化失败，请重试" │
          │  原文 | 修改文     │  │  [重试] [关闭]    │
          └────────┬─────────┘  └────────┬─────────┘
                   │                     │ 重试
           ┌───────┴───────┐             │
           │               │             ▼
           ▼               ▼     ┌──────────────────┐
   ┌────────────┐  ┌──────────┐  │   LOADING (重试)  │
   │ ACCEPTED   │  │ REJECTED │  └──────────────────┘
   │ 替换原文    │  │ 关闭弹窗  │
   │ toast提示   │  │ 原文不变  │
   │ undo可用    │  │          │
   └────────────┘  └──────────┘
           │               │
           └───────┬───────┘
                   ▼
          ┌──────────────────┐
          │   IDLE           │
          │   (回到初始状态)   │
          └──────────────────┘
```

### 6.2 续写状态机

```
                    ┌─────────────────────┐
                    │   IDLE              │
                    │   光标在 prose 中     │
                    └─────────┬───────────┘
                              │ 点击 "继续写作"
                              ▼
                    ┌─────────────────────┐
                    │   STREAMING         │ ←── 选区锁定已释放
                    │   SSE 流式输出       │     (续写不需要选区)
                    │   闪烁光标           │
                    └─────────┬───────────┘
                         ┌───┴───┐
                         │       │
                         ▼       ▼
                 ┌──────────┐ ┌──────────┐
                 │ 完成      │ │ 用户停止  │
                 │ onDone    │ │ abort()  │
                 └────┬─────┘ └────┬─────┘
                      │            │
                      ▼            ▼
                 ┌──────────────────────┐
                 │   SAVING             │
                 │   自动保存 prose      │
                 └──────────┬───────────┘
                            │
                            ▼
                    ┌─────────────────────┐
                    │   IDLE              │
                    │   可继续操作         │
                    └─────────────────────┘
```

---

## 7. 选区追踪方案

### 7.1 问题分析

用户在 textarea 中选中文字后，如果鼠标移出 textarea 去点击按钮，选区会丢失（有的浏览器会保留但不可靠）。

### 7.2 解决策略: mousedown 锁定

**方案**: 在 RightToolbar 的按钮上使用 `onMouseDown` 而非 `onClick` 来捕获选区。

```typescript
// ChapterEditor 通过 ref 暴露选区
const proseTextareaRef = useRef<HTMLTextAreaElement>(null);
const selectionCaptureRef = useRef<SelectionCapture | null>(null);

// 每次选区变化时更新 (onMouseUp / onKeyUp)
const handleSelectionChange = () => {
  const ta = proseTextareaRef.current;
  if (!ta) return;
  if (ta.selectionStart !== ta.selectionEnd) {
    selectionCaptureRef.current = {
      start: ta.selectionStart,
      end: ta.selectionEnd,
      text: ta.value.slice(ta.selectionStart, ta.selectionEnd),
      fullText: ta.value,
    };
  } else {
    selectionCaptureRef.current = null;
  }
};

// RightToolbar 使用 onMouseDown (不是 onClick)
<button
  onMouseDown={(e) => {
    e.preventDefault(); // 防止焦点丢失
    const capture = selectionCaptureRef.current;
    if (!capture) {
      toast.warning("请先选中文字");
      return;
    }
    onPolish(capture);
  }}
>
  润色
</button>
```

**为什么不用 onClick**: `onMouseDown` 在鼠标按下时触发，此时 textarea 还持有焦点，选区尚未丢失。`onClick` 在鼠标抬起时触发，此时焦点可能已移到按钮上，选区丢失。

### 7.3 数据流

```
ChapterEditor (textarea)
  │ 持有 ref: proseTextareaRef
  │ 持有 ref: selectionCaptureRef
  │ 事件: onMouseUp, onKeyUp → 更新 selectionCaptureRef
  │ 暴露给父组件: (通过回调或 context)
  │
  ▼
NovelPage (布局容器)
  │ 接收: hasSelection, selectedText
  │ 传递给: RightToolbar
  ▼
RightToolbar
  │ 按钮 onMouseDown → 读取当前选区
  │ 调用 ChapterEditor 的 handlePolish/handleExpand
```

### 7.4 另一种方案 (备选)

如果 mousedown 方案在 React 事件系统中不稳定，可以使用 `window.getSelection()` 在 button 事件中直接捕获：

```typescript
const handlePolishClick = () => {
  const textarea = document.querySelector('.chapter-editor-textarea') as HTMLTextAreaElement;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  // 这时选区可能已丢失 → 用 savedSelectionRef
  if (selectionCaptureRef.current) {
    // 使用锁定的选区
  }
};
```

**推荐方案组合**: 两者结合 — 在按钮 mousedown 时读取 `selectionCaptureRef.current`（定期更新），同时在 `onMouseUp` 和 `onKeyUp` 时持续刷新该 ref。

---

## 8. 边界情况与容错

### 8.1 选区相关

| 边界情况 | 处理方式 |
|---------|---------|
| 选区为空字符串 (start === end) | 按钮置灰，tooltip "请先选中文字" |
| 选区选中了整个文档 | 正常工作，但 toast 提示 "已选中全文" |
| 选区包含标题标记 (如 `# 第一章`) | 前端不过滤，由后端 prompt 处理 |
| 选区跨段落 | 保持选中状态，后端处理多段落 |
| 选区在 textarea 不可见区域 | 不需要特殊处理，textarea 保持完整内容 |
| 用户选中后拖拽改变选区 | 以最后一次 mouseup 的位置为准 |
| 在 focus mode 下选区 | 与正常模式完全一致 |
| 切换章节后上一个选区残留 | 切换章节时清空 selectionCaptureRef |

### 8.2 文本长度

| 边界情况 | 处理方式 |
|---------|---------|
| 润色选中文本 > 1000 字 | 前端限制（toast "选中文本过长，建议分段润色"），如 API 支持则无限制 |
| 润色选中文本 < 5 字 | toast "选中的文字过短，润色效果可能不佳"（仅提示，不阻止） |
| 扩写选中文本 > 500 字 | 提示"扩写建议选中较短段落" |
| AI 返回空字符串 | Error 状态 + toast "AI 返回为空，请重试" |
| AI 返回的内容与原文完全相同 | 对比预览两侧显示一致，用户仍可接受（无实际变化） |

### 8.3 并发

| 边界情况 | 处理方式 |
|---------|---------|
| 用户快速点击两次润色 | 按钮在 loading 状态 disabled，第二次点击无效 |
| 润色请求中用户开始编辑 | 锁定编辑器（显示非模态遮罩 "AI 优化中，请稍候"） |
| 续写中点击润色 | 续写按钮变为停止，loading 时润色按钮 disabled |
| 润色预览中继续编辑原文 | 关闭预览弹窗（提示 "原文已修改，将关闭预览"） |

### 8.4 API 错误

| 错误场景 | 用户看到什么 | 操作 |
|---------|------------|------|
| 网络错误 | 错误 toast: "网络连接失败" | [重试] [关闭] |
| API 超时 (>15s) | toast: "请求超时" | [重试] [关闭] |
| API 返回 4xx/5xx | toast: "优化失败: {错误详情}" | [重试] [关闭] |
| Token 不足 | toast: "余额不足" | [前往充值] [关闭] |
| 选中文本为空 (后端校验) | toast: "请选中有效文本" | [关闭] |

### 8.5 撤销 (Undo)

接受润色/扩写后，原文被替换。此时需要支持撤销。

**方案**: 每次 ReplaceText 操作推入 undo stack。

```typescript
// 在 ChapterEditor 中维护 undo stack
interface UndoEntry {
  type: 'polish' | 'expand' | 'edit';
  previousText: string;
  previousStart: number;
  previousEnd: number;
  timestamp: number;
}

const undoStackRef = useRef<UndoEntry[]>([]);

const handleAcceptPolish = (capture: SelectionCapture, newText: string) => {
  // 压入 undo stack
  undoStackRef.current.push({
    type: 'polish',
    previousText: capture.text,
    previousStart: capture.start,
    previousEnd: capture.end,
    timestamp: Date.now(),
  });
  
  // 替换原文
  const newProse = 
    capture.fullText.slice(0, capture.start) + 
    newText + 
    capture.fullText.slice(capture.end);
  
  setProse(newProse);
};
```

**快捷键**: `Ctrl+Z` 撤销上一步润色/扩写操作（复用浏览器原生 undo 在 textarea 上有限支持，需自定义实现）。

**简化建议**: 不需要自定义 undo stack — 每一次润色接受触发一次自动保存，用户可以通过版本历史回退。但为更好体验，至少提供以下方案：

> **推荐**: 接受润色后，显示一个 toast 条 "已替换 [撤销]"，3 秒内可点击撤销。超时后撤销条消失，只能通过版本历史恢复。

```tsx
// 接受后显示可撤销的 toast
const handleAccept = () => {
  // 执行替换...
  toast.success(
    <span>
      已替换 
      <button onClick={handleUndo}>撤销</button>
    </span>,
    { duration: 3000 }
  );
};
```

---

## 9. 实现注意事项

### 9.1 组件依赖树

```
NovelPage
 ├── ChapterEditor
 │    ├── prose textarea (ref: proseTextareaRef)
 │    ├── streaming display (已有)
 │    └── undo support (新增)
 ├── RightToolbar
 │    ├── 续写按钮 (改造)
 │    ├── 润色按钮 (改造 + onMouseDown)
 │    └── 扩写按钮 (改造 + onMouseDown)
 └── ContrastPreviewModal (新增)
      └── ActionBar (Accept/Reject/Retry)
```

### 9.2 ChapterEditor 改动清单

```
新增状态:
  - selectionCaptureRef: RefObject<SelectionCapture | null>
  - undoStackRef: RefObject<UndoEntry[]>
  - polishLoading: boolean
  - expandLoading: boolean
  - continueLoading: boolean

新增方法:
  - handleContinueWriting()
  - handlePolish(capture: SelectionCapture)
  - handleExpand(capture: SelectionCapture)
  - handleAcceptPolish(capture: SelectionCapture, newText: string)
  - handleUndoPolish()

新增事件绑定:
  - textarea onMouseUp → handleSelectionChange
  - textarea onKeyUp → handleSelectionChange

改动:
  - handleStartWriting → 保留 (用于 AI 写本章)
```

### 9.3 RightToolbar 改动清单

```
新增 props:
  - hasSelection: boolean
  - onContinue: () => void
  - onPolish: () => void
  - onExpand: () => void
  - continueLoading: boolean
  - polishLoading: boolean
  - expandLoading: boolean

改动:
  - "继续写作" 按钮 onClick → 调用 props.onContinue
  - "润色" 按钮:
    * onClick → onMouseDown (避免选区丢失)
    * disabled → !hasSelection || polishLoading
    * tooltip → "请先选中文字" (当 !hasSelection)
  - "扩写" 按钮: 同上
```

### 9.4 API 集成

在 `client/frontend/src/lib/ai.ts` 中新增:

```typescript
// SSE 流式续写
export function streamChapterContinue(
  projectId: string,
  chapterRef: string,
  cursorPosition: number,
  callbacks: StreamCallbacks,
): AbortController;

// 非流式润色 (返回修改后的文本)
export async function polishText(
  projectId: string,
  chapterRef: string,
  selectedText: string,
  context?: string,  // 前后文
): Promise<string>;

// 非流式扩写
export async function expandText(
  projectId: string,
  chapterRef: string,
  selectedText: string,
  context?: string,
): Promise<string>;
```

### 9.5 响应式适配

| 断点 | ContrastPreviewModal | 按钮布局 |
|------|---------------------|---------|
| >= 1024px (桌面) | 水平分栏 (左右) | 正常三按钮 |
| 640-1023px (平板) | 水平分栏 (可滚动) | 正常三按钮 |
| < 640px (手机) | 垂直分栏 (上下) | 续写按钮单独一行，润色/扩写在小屏幕上折叠到 "更多" 菜单 |

### 9.6 性能考量

- **润色/扩写预览使用非流式 API** — 对于 200-500 字的润色，非流式响应通常在 3-5 秒内返回。流式预览会增加前端复杂度，没有必要。
- **ContrastPreviewModal 懒加载** — 只有打开时才渲染内容，关闭时卸载 DOM。
- **选区追踪无性能开销** — `onMouseUp`/`onKeyUp` 事件是轻量操作。
- **长文本渲染** — 对比预览中使用 `whitespace-pre-wrap` 和 `max-height` + `overflow-y-auto`，避免渲染完整 DOM 树。

### 9.7 动画过渡

| 场景 | 动画 | 持续时间 |
|------|------|---------|
| 弹窗出现 | fadeIn + scale(0.95→1) + 微透明背景 | 200ms |
| 弹窗关闭 | fadeOut | 150ms |
| 加载 → 预览 | 右侧内容淡入 | 300ms |
| 接受替换 | 原文增加高亮闪烁（绿色） | 800ms |
| 按钮 disabled → enabled | 渐变透明度 | 150ms |

```css
/* 弹窗进入动画 */
@keyframes modal-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-content {
  animation: modal-enter 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
}
```

---

## 10. 开发者验收检查清单

### 功能验收

- [ ] 选中文字后，"润色"/"扩写"按钮从灰色变为可用状态
- [ ] 不选中文字时，鼠标悬停显示 tooltip "请先选中文字"
- [ ] 点击润色后弹出对比预览弹窗
- [ ] 对比预览左右分栏清晰标注"原文"和"润色后"
- [ ] 接受后原文被替换，显示"已替换 [撤销]" toast
- [ ] 拒绝后弹窗关闭，原文不变
- [ ] 换一个可重新请求 AI
- [ ] 续写从光标位置开始 SSE 流式输出
- [ ] 续写完成自动保存
- [ ] 续写中可点击停止
- [ ] 快速双击润色只在第一次生效（loading 状态 disabled）
- [ ] 润色中编辑原文，弹窗自动关闭并提示
- [ ] 切换章节清空选区状态
- [ ] API 失败显示错误 toast，可重试

### 视觉验收

- [ ] 润色/扩写弹窗在 novelforge dark 主题下可读
- [ ] 润色/扩写弹窗在 parchment light 主题下可读
- [ ] 对比预览左侧灰色标签，右侧琥珀色标签
- [ ] 按钮 disabled 状态视觉清晰（opacity + cursor: not-allowed）
- [ ] 弹窗动画流畅
- [ ] 选中文字在 textarea 中的高亮颜色与主题匹配
- [ ] 接受后的闪烁反馈可见
- [ ] 按钮 hover / active / focus 状态正确

### 无障碍验收

- [ ] 润色/扩写按钮在 disabled 时仍然可用键盘 focus
- [ ] 弹窗支持 Escape 关闭
- [ ] 对比预览区域可通过 Tab 键导航到操作按钮
- [ ] 按钮 aria-label: "续写", "润色选中文本", "扩写选中文本"
- [ ] 弹窗 role="dialog" aria-modal="true" aria-label="AI 润色建议"
- [ ] 对比预览中原文/修改文有 aria-label 区分

---

## 附录: 设计修改历史

| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|---------|-------|
| v1.0 | 2026-07-24 | 初版设计规范 | UI Designer |

---

*本规范对应 Issue #39 前端实现部分。后端 API 规范见 Issue #39 主描述。*
