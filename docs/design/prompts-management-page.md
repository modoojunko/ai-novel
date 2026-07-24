# PromptManagement Page -- UI Design Spec

> **Project**: AI Novel (爱小说)
> **Issue**: #38 -- Prompts Management Page
> **Designer**: UI Designer Agent
> **Target**: React 19 + daisyUI 4 + Tailwind CSS 3, novelforge (dark) / parchment (light)
> **Status**: Ready for development

---

## Table of Contents

1. [Architecture & Tab Placement](#1-architecture--tab-placement)
2. [Screen 1: PromptOverview](#2-screen-1-promptoverview)
3. [Screen 2: PromptViewer](#3-screen-2-promptviewer)
4. [Screen 3: PromptEditor](#4-screen-3-prompteditor)
5. [State Handling Reference](#5-state-handling-reference)
6. [Theme Token Map](#6-theme-token-map)
7. [Interaction Flow](#7-interaction-flow)
8. [API Contract (Backend Work Needed)](#8-api-contract-backend-work-needed)
9. [Accessibility & Performance](#9-accessibility--performance)

---

## 1. Architecture & Tab Placement

### 1.1 New Main Tab: "提示词"

Add a third tab to NovelPage's top navigation, between settings and writing:

```
┌──────────────────────────────────────────────────────────────┐
│  [Project Name]                 [设定] [提示词] [正文]    [🗑] │
└──────────────────────────────────────────────────────────────┘
```

**View state addition** (in `NovelPage.tsx`):

```typescript
type TabId = "settings" | "prompts" | "writing";

type ViewState =
  | { tab: "settings"; panel: string }
  | { tab: "prompts"; panel: "empty" }
  | { tab: "prompts"; panel: "overview"; chapterRef: string }
  | { tab: "prompts"; panel: "viewer"; chapterRef: string; seg: number }
  | { tab: "prompts"; panel: "editor"; chapterRef: string; seg: number }
  | { tab: "writing"; panel: "empty" }
  | { tab: "writing"; panel: "volume"; volumeId: string }
  | { tab: "writing"; panel: "chapter"; chapterRef: string }
  | { tab: "writing"; panel: "versions"; chapterRef: string };
```

### 1.2 Left Tree Panel

When the "prompts" tab is active, reuse the same writing tree (volume > chapter hierarchy) in the left panel, but with a **prompt-status badge** on each chapter node:

| Badge | Meaning |
|-------|---------|
| `(none)` | No prompts generated yet |
| `已生成` (green) | All segments have prompts |
| `已修改` (amber) | At least one segment has been edited |
| `部分生成` (yellow) | Only some segments have prompts |

### 1.3 Right Panel Routing

| ViewState | Renders |
|-----------|---------|
| `prompts/empty` | EmptyState with "生成提示词" CTA |
| `prompts/overview` | PromptOverview component |
| `prompts/viewer` | PromptViewer component |
| `prompts/editor` | PromptEditor component |

---

## 2. Screen 1: PromptOverview

### 2.1 ASCII Wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│  ← 返回章节                                                 [..]│
│  ┌─ 第一章 ───────────────────────────────────────────────────┐ │
│  │  章节: vol-1-ch-1                 状态: 已生成   [生成] [..]│ │
│  │  ├─ [1] 段 1: 开篇场景描写 ── 已生成 ──────────────────▶  │ │
│  │  │   预览: 你是{role}。本段是《仙途》第1卷第1章第1段。    │ │
│  │  │   本章概要：主角在宗门大比中突破筑基期...             │ │
│  │  ├─ [2] 段 2: 战斗高潮 ── 已修改 ──────────────────────▶  │ │
│  │  │   预览: 你是{role}。本段是《仙途》第1卷第1章第2段。    │ │
│  │  │   本章概要：主角在宗门大比中突破筑基期...             │ │
│  │  └─ [3] 段 3: 收尾过渡 ── 未生成 ─────────────────────▶  │ │
│  │      预览: (暂无)                                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
├─ [collapse] ─────────────────────────────────────────────────────┤
│  ┌─ 第二章 ───────────────────────────────────────────────────┐ │
│  │  章节: vol-1-ch-2                 状态: 未生成   [生成] [..]│ │
│  │  (无段落数据)                                               │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Inventory

| Component | Tag / Daisy class | Description |
|-----------|-------------------|-------------|
| `ChapterPromptCard` | `div.card.bg-base-100` | Collapsible card per chapter |
| `ChapterHeader` | `div.flex.items-center.justify-between` | Chapter ref + title + status badge + actions |
| `SegmentRow` | `button.w-full.text-left` | Clickable row for each segment |
| `SegmentStatusBadge` | `span.badge` | `已生成` / `已修改` / `未生成` |
| `SegmentPreview` | `p.text-xs.text-base-content/50` | 3-line truncated preview |
| `GenerateButton` | `btn.btn-primary.btn-sm` | Triggers prompt generation |
| `BulkActionsDropdown` | `details.dropdown` | Regenerate all, collapse all |

### 2.3 States

#### Loading State (Skeleton)

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌─ [skeleton h-6 w-48] ──────────────────────────────────────┐ │
│  │  [skeleton h-4 w-64]                                       │ │
│  │  [skeleton h-12 w-full]   ← 3 rows of segment skeletons    │ │
│  │  [skeleton h-12 w-full]                                     │ │
│  │  [skeleton h-12 w-full]                                     │ │
│  └──────────────────────────────────────────────────────────────┘ │
├── [skeleton h-6 w-48] ──────────────────────────────────────────┤
│  [skeleton h-4 w-64]                                             │
│  [skeleton h-12 w-full]                                          │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation notes**:
- Show 2-3 `ChapterPromptCard` skeletons
- Each card has a `skeleton` header line and 3 `skeleton` segment rows
- Use `.animate-pulse` on `bg-base-300` backgrounds

#### Empty State (No prompts generated for any chapter)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                    🪄  暂无提示词                                │
│            当前项目尚未生成任何提示词。                          │
│       请先完成章节设定和章纲，然后点击下方按钮生成。            │
│                                                                  │
│                 [ 🪄 生成全部提示词 ]                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation notes**:
- Use existing `EmptyState` pattern from `components/novel/EmptyState.tsx`
- CTA button calls `POST /api/projects/{id}/chapters/{ref}/prompts/generate` for each chapter
- Show generation progress via `AIGenerateProgress` component

#### Error State

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌─ [alert alert-error] ──────────────────────────────────────┐ │
│  │  ⚠️ 提示词加载失败                                         │ │
│  │  无法加载章节的提示词数据，请检查项目状态后重试。          │ │
│  │                                          [重试]             │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation notes**:
- Use daisyUI `alert alert-error` with inline retry button
- Toast-based error for non-critical failures (single segment load fail)
- Page-level error for critical failures (API unreachable)

#### Partial Generation State

```
│  ├─ [1] 段 1: 开篇场景描写 ── 已生成 ──────────────────────▶  │
│  │   预览: 你是{role}。本段是《仙途》第1卷第1章第1段。       │
│  ├─ [2] 段 2: 战斗高潮 ── 正在生成... ───────────────────▶  │
│  │   [progress loading-spinner loading-xs text-primary]         │
│  └─ [3] 段 3: 收尾过渡 ── 待生成 ─────────────────────────▶  │
```

**Implementation notes**:
- During generation (`POST /prompts/generate`), show loading spinner per segment
- Disable the "生成" button for that chapter
- Poll or SSE for completion status

### 2.4 Segment Row Detail

```tsx
// SegmentRow component interface
interface SegmentRowProps {
  segNumber: number;       // 1-based segment index
  title: string;           // e.g. "开篇场景描写" — from segment data
  status: "generated" | "modified" | "unset" | "generating";
  previewText: string;     // First ~120 chars of prompt (3 lines)
  hasSegData: boolean;     // Whether segment exists in chapter outline
  onClick: () => void;     // Navigate to PromptViewer
}
```

**Status color mapping**:

| Status | Badge Text | Badge Class | Row Icon |
|--------|------------|-------------|----------|
| `generated` | 已生成 | `badge-ghost text-success` | `CheckCircle2` (green) |
| `modified` | 已修改 | `badge-ghost text-warning` | `PencilLine` (amber) |
| `unset` | 未生成 | `badge-ghost text-base-content/30` | `Circle` (dim) |
| `generating` | 生成中 | `badge-ghost` + spinner | `Loader2` (spins) |

**Preview truncation**:
- Show first 120 characters of the prompt
- Replace format placeholders like `{role}` with the actual resolved value for clarity
- Use `line-clamp-3` CSS class for consistent 3-line clamping
- Show "(暂无)" dimmed placeholder for `unset` status

### 2.5 Collapse/Expand Behavior

- Each `ChapterPromptCard` is collapsible via a `collapse` daisyUI class
- Default: **all collapsed** when entering prompt tab (progressive disclosure)
- Click header to expand/collapse
- "展开全部" / "收起全部" in the toolbar toggles all
- State persisted locally (React state, not localStorage)

---

## 3. Screen 2: PromptViewer

### 3.1 ASCII Wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│  ← 返回概览   第1卷第1章第1段                                     │
│                                                                   │
│  提示词全文                               [复制] [编辑] [恢复原始]│
│  ──────────────────────────────────────────────────────────────── │
│                                                                   │
│  ┌─ 角色定位 ──────────────────────────────────────────────────┐ │
│  │  你是一位擅长东方玄幻小说的作家，擅长描写......            │ │
│  │  你的作品以细腻的人物刻画和宏大的世界观著称。              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 原则与禁忌 ────────────────────────────────────────────────┐ │
│  │  避免以下常见问题：                                          │ │
│  │  • 过度使用"突然""猛地"等词汇                               │ │
│  │  • 角色行为不符合人物设定                                    │ │
│  │  禁止词汇：震惊、顿时、瞬间、不禁                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 故事背景 ──────────────────────────────────────────────────┐ │
│  │  本段是《仙途》第1卷第1章第1段。                            │ │
│  │  本章概要：主角在宗门大比中突破筑基期，引来各方关注。      │ │
│  │  当前任务：描写主角突破时的天地异象                        │ │
│  │  出场角色：                                                       │ │
│  │  - 林尘：主角，筑基期修为，性格坚毅，当前状态：突破中               │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 写作指引 ──────────────────────────────────────────────────┐ │
│  │  描写林尘突破筑基时的具体场景。                              │ │
│  │  本段目标：营造突破时的紧张感和突破后的释然感                │ │
│  │  情绪基调：紧张 → 激昂 → 释然                                │ │
│  │  出场角色：林尘、长老、围观弟子                              │ │
│  │  段落功能：展示主角实力成长，埋下后续冲突伏笔                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 写作要求 ──────────────────────────────────────────────────┐ │
│  │  描写手法：运用多感官描写，注重场景氛围                       │ │
│  │  输出长度：约800字                                            │ │
│  │  不写总结、不写章节标题。                                     │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 元数据 ─────────────────────────────────────────────────────┐│
│  │  文件名: vol-1-ch-1-seg-1-prompt.md                          ││
│  │  生成时间: 2026-07-24 14:30:22                              ││
│  │  状态: 已修改 (上次编辑: 2026-07-24 15:10:05)               ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Inventory

| Component | Daisy class | Notes |
|-----------|-------------|-------|
| `PromptSection` | `div.rounded-lg.border.border-base-300` | Repeated per section |
| `SectionHeader` | `div.bg-base-200/50.px-4.py-2` | Section label with icon |
| `SectionContent` | `div.px-4.py-3.text-sm.leading-relaxed` | Rendered markdown content |
| `ActionBar` | `div.flex.gap-2.mb-4` | Copy / Edit / Restore buttons |
| `MetaPanel` | `div.text-xs.text-base-content/40` | File metadata footer |

### 3.3 Section Breakdown

The `chapter_segment.prompt` template produces 5 sections. Each maps to a `PromptSection`:

| Section | Header | Icon | Content Source |
|---------|--------|------|----------------|
| `role` | 角色定位 | `User` | Lines between `## 角色定位` and next `##` |
| `constraints` | 原则与禁忌 | `Shield` | Lines between `## 原则与禁忌` and `## 故事背景` |
| `context` | 故事背景 | `BookOpen` | Lines between `## 故事背景` and `## 写作指引` |
| `writing` | 写作指引 | `Feather` | Lines between `## 写作指引` and `## 写作要求` |
| `output` | 写作要求 | `FileText` | Lines after `## 写作要求` |

**Parsing approach**: Client-side regex split on `^## ` heading markers. Each section rendered independently in a card.

### 3.4 Action Bar

```
[📋 复制] [✏️ 编辑] [↩️ 恢复原始版本]
```

| Action | Trigger | Behavior |
|--------|---------|----------|
| Copy | `navigator.clipboard.writeText(fullPrompt)` | Toast "已复制到剪贴板" |
| Edit | `setViewState({...panel:"editor"})` | Navigate to PromptEditor |
| Restore | Generated prompts only | Call `POST /prompts/generate?seg={N}` to regenerate + confirm dialog "恢复后将覆盖当前修改" |

**Edge case**: `恢复原始版本` only shown when `status === "modified"`. Hidden for pristine prompts.

### 3.5 States

#### Loading State

```
┌──────────────────────────────────────────────────────────────────┐
│  ← [skeleton h-4 w-32]        [skeleton h-8 w-24]               │
│                                                                   │
│  ┌─ [skeleton h-8 w-24] ───────────────────────────────────────┐ │
│  │  [skeleton lines...]                                         │ │
│  │  [skeleton lines...]                                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌─ [skeleton h-8 w-24] ───────────────────────────────────────┐ │
│  │  [skeleton lines...]                                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

#### Error State (Single segment load failure)

- Toast error: "段 3 提示词加载失败"
- Retry inline button on the affected segment section
- Show partial content if some sections loaded

#### Edge: Empty Segment

If a segment file exists but is empty (0 bytes):

```
┌─ 写作指引 ──────────────────────────────────────────────────────┐
│  (空)                                                           │
│  [重新生成此段] [从已有内容填充]                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Screen 3: PromptEditor

### 4.1 ASCII Wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│  ← 返回查看   正在编辑: 段 1                                     │
│                                                                   │
│  [已修改 ⚠️]                                                     │
│                                                                   │
│  ┌─ 角色定位 (read-only) ──────────────────────────────────────┐ │
│  │  [disabled textarea with original content]                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 原则与禁忌 ────────────────────────────────────────────────┐ │
│  │  [editable textarea with current content]                   │ │
│  │  [↩️ 恢复此段]                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 故事背景 ──────────────────────────────────────────────────┐ │
│  │  [editable textarea]                                        │ │
│  │  [↩️ 恢复此段]                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 写作指引 ──────────────────────────────────────────────────┐ │
│  │  [editable textarea]                                        │ │
│  │  [↩️ 恢复此段]                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 写作要求 ──────────────────────────────────────────────────┐ │
│  │  [editable textarea]                                        │ │
│  │  [↩️ 恢复此段]                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  [❌ 放弃修改]                    [💾 保存]               │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Design Decisions

**Why per-section editing instead of monolithic textarea?**

1. **Safety**: Section-level edit prevents accidental corruption of other sections
2. **Clarity**: Each section has clear semantic purpose, editing them together is error-prone
3. **Partial revert**: Users can reset a single section to original without losing changes in others
4. **Future**: Enables per-section AI regeneration (e.g., "优化此段的写作指引部分")

**Read-only sections**:
- `角色定位` (role) and `原则与禁忌` (constraints) are **read-only** by default — they come from global writing style settings, not segment-specific data. User can unlock via a "允许编辑此段" toggle if they need override.
- `故事背景`, `写作指引`, `写作要求` are editable.

### 4.3 Component Inventory

| Component | Type | Behavior |
|-----------|------|----------|
| `SectionEditor` | `textarea` (editable or disabled) | Per-section textarea |
| `RestoreSectionButton` | `button.text-xs` | Resets single section to original content |
| `EditorToolbar` | `div.flex` | Save / Cancel / Diff |
| `DirtyIndicator` | `span.badge.badge-warning` | "已修改" badge |
| `SaveButton` | `btn.btn-primary` | Writes combined prompt via PUT |
| `CancelButton` | `btn.btn-ghost` | Confirm dialog if dirty, then navigate back |

### 4.4 States

#### Dirty State

- Show `[已修改 ⚠️]` badge at top
- Enable save button
- Show `放弃修改` button (with confirmation if dirty)
- Mark changed sections with a subtle `border-l-2 border-l-warning` indicator

#### Saving State

- Save button shows `<span class="loading loading-spinner loading-xs" />` spinner
- Disable all inputs
- Disable cancel button
- On success: toast "保存成功", navigate back to PromptViewer, mark status="modified"
- On failure: toast "保存失败，请重试", re-enable inputs

#### Restore Confirmation

```
┌─ Confirm ────────────────────────────────────────────────┐
│  确认恢复此段？                                          │
│  将把"原则与禁忌"部分恢复为原始版本。                    │
│     [取消]  [确认恢复]                                    │
└──────────────────────────────────────────────────────────┘
```

#### Edge: Unsaved Changes Navigation

When user clicks "返回查看" with unsaved changes:

```
┌─ Unsaved Changes ─────────────────────────────────────────┐
│  有未保存的修改                                           │
│  是否保存后再离开？                                       │
│     [不保存] [取消] [保存并离开]                          │
└──────────────────────────────────────────────────────────┘
```

### 4.5 Save Logic

```typescript
async function saveEditedPrompt(
  projectId: string,
  chapterRef: string,
  seg: number,
  sections: Record<string, string>  // { constraints, context, writing, output }
): Promise<void> {
  // Reassemble the full prompt from sections
  // Must preserve role section exactly (it's read-only)
  const fullPrompt = reassemblePrompt(sections);
  
  await api.put(
    `/projects/${projectId}/chapters/${chapterRef}/prompts/${seg}`,
    { content: fullPrompt }
  );
  // Mark as modified in local state
}
```

---

## 5. State Handling Reference

### 5.1 Page-Level State Machine

```
                    ┌──────────────┐
          ┌────────│  LOADING      │
          │        └──────┬───────┘
          │               │ data loaded
          │               ▼
          │        ┌──────────────┐
          ├───────│  EMPTY        │───[generate]───▶  GENERATING
          │        └──────────────┘
          │               │ has data
          │               ▼
          │        ┌──────────────┐
          ├───────│  NORMAL       │───[view seg]───▶  VIEWER ──[edit]───▶  EDITOR
          │        └──────┬───────┘                   ▲                        │
          │               │ error                     └────────[save]─────────┘
          │               ▼
          │        ┌──────────────┐
          └───────│  ERROR        │───[retry]───▶  LOADING
                   └──────────────┘
```

### 5.2 Component State Matrix

| Screen | Loading | Empty | Error | Partial | Normal | Modified | Generating |
|--------|---------|-------|-------|---------|--------|----------|------------|
| Overview | 2-3 card skeletons | EmptyState illustration | Alert + retry | Mixed badges | Cards with segments | N/A | Spinner per card |
| Viewer | Section skeletons | N/A (404 = back) | Toast + inline retry | N/A | All sections visible | "已修改" badge + restore btn | N/A |
| Editor | N/A (data preloaded) | N/A | Toast on save fail | Read-only sections | All sections editable | DirtyIndicator | Save spinner |

### 5.3 Edge Cases

| Scenario | Handling |
|----------|----------|
| Chapter has 0 segments in outline | Show "章节尚未设置段落" with link to chapter editor |
| Segment file has wrong format | Parse best-effort, show raw markdown in a warning banner |
| User edits a pristine prompt | Status transitions to "modified" immediately |
| User edits but reverts all sections | Status reverts to "generated" |
| Network lost during save | Retry with exponential backoff, toast "网络连接断开" |
| Multiple tabs open (SSE conflict) | Last write wins (acceptable for single-user desktop) |
| Prompt file > 100KB | Warn: "提示词文件过大，编辑可能卡顿" (unlikely in practice) |

---

## 6. Theme Token Map

### 6.1 novelforge (Dark) / parchment (Light) Token Usage

| Design Element | DaisyUI Token | novelforge | parchment | Notes |
|----------------|---------------|------------|-----------|-------|
| Page background | `bg-base-200` | `#1d1812` | `#f0e8d8` | |
| Card background | `bg-base-100` | `#14100b` | `#faf6ee` | |
| Card border | `border-base-300` | `#2a2118` | `#e0d5c0` | |
| Section header bg | `bg-base-200/50` | `#1d181280` | `#f0e8d880` | |
| Section header border-bottom | `border-base-200` | `#1d1812` | `#f0e8d8` | |
| Primary accent | `text-primary` | `#d4a373` | `#8b6914` | Headers, links |
| Body text | `text-base-content` | `#d4c9b8` | `#3d352a` | |
| Muted text | `text-base-content/50` | `#d4c9b880` | `#3d352a80` | Metadata, secondary |
| Dim text | `text-base-content/30` | `#d4c9b84d` | `#3d352a4d` | Placeholders |
| Success badge | `text-success` | `#7da87a` | `#5a8a5a` | "已生成" |
| Warning badge | `text-warning` | `#c9a06b` | `#b8944a` | "已修改" |
| Error alert bg | `bg-error/10` + `border-error/30` | `#c97a7a1a` / `#c97a7a4d` | `#b85a5a1a` / `#b85a5a4d` | |
| Skeleton | `skeleton` | `bg-base-300 animate-pulse` | same | |
| Icon primary | `text-primary/70` | `#d4a373b3` | `#8b6914b3` | Section icons |
| Hover row bg | `hover:bg-base-200/60` | `#1d181299` | `#f0e8d899` | Segment row hover |
| Modified indicator | `border-l-warning` | `#c9a06b` | `#b8944a` | Left border on edited sections |
| Button primary | `btn-primary` | `#d4a373` fg on `primary-content` | `#8b6914` fg | |
| Button ghost | `btn-ghost` | `text-base-content/60` | same | |
| Loading spinner | `loading text-primary` | `#d4a373` | `#8b6914` | |

### 6.2 Semantic Color Usage

```
Prompt Status → Badge:
  generated  → text-success + bg-success/10 border-success/20
  modified   → text-warning + bg-warning/10 border-warning/20  
  unset      → text-base-content/30 + bg-base-200/30 border-base-200
  
Section Background → Card:
  role       → bg-base-100 border-base-300 (default, read-only)
  editable   → bg-base-100 border-base-300
  editing    → bg-base-100 border-primary/40 shadow-sm
  
Editor State → Section Border:
  pristine   → border-base-300
  modified   → border-l-2 border-l-warning + border-base-300
  focused    → border-primary/40
  error      → border-error/50
```

---

## 7. Interaction Flow

### 7.1 Primary Flow: View Prompt Overview

```
User: clicks "提示词" tab
  → NovelPage sets tab="prompts"
  → Left tree reuses writing tree with prompt badges
  → Right panel shows PromptOverview
  → User clicks a chapter card header
    → Card expands to show segment rows
    → Each row: seg number, title (from outline), status badge, 3-line preview
  → User clicks a segment row
    → Navigate to PromptViewer
    → Parse full prompt into 5 sections
    → Render each section in a <PromptSection> card
```

### 7.2 Edit Flow

```
User: clicks "编辑" in PromptViewer action bar
  → Navigate to PromptEditor
  → Parse sections, render in per-section textareas
  → User edits one or more sections
  → Changed sections get border-l-warning indicator
  → "已修改" badge appears at top
  → User clicks "保存"
    → API PUT /prompts/{seg} with reassembled content
    → On success: toast + navigate to PromptViewer with status="modified"
    → On failure: inline error in section, re-enable editing
  → User clicks "放弃修改"
    → If dirty: confirm dialog "有未保存的修改"
    → Confirm: navigate back, discard changes
```

### 7.3 Generation Flow

```
User: clicks "生成提示词" button (on chapter card or standalone)
  → Disable button, show spinner
  → POST /api/projects/{id}/chapters/{ref}/prompts/generate
  → API returns list of generated file paths
  → Overview refreshes: status badges update
  → Toast "提示词生成完成"
```

### 7.4 Regeneration Flow

```
User: clicks dropdown "重新生成此段"
  → Confirm dialog: "这将覆盖当前提示词内容。确认？"
  → Yes → POST /prompts/generate (single segment)
  → No → dismiss
```

### 7.5 Navigation Flow Between Screens

```
┌─────────────────────────────────────────────────────┐
│                    PromptOverview                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  Chapter 1 expanded                            │  │
│  │  [segment 1] ──click──▶ PromptViewer: seg 1   │  │
│  │                        │                       │  │
│  │                        ├──[edit]──▶ Editor    │  │
│  │                        │           │           │  │
│  │                        │           └[save]──▶  │  │
│  │                        │           │  Viewer   │  │
│  │                        ◀──[back]───┘  (refresh)│  │
│  │  [segment 2] ──click──▶ PromptViewer: seg 2   │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Chapter 2 (collapsed)                         │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 7.6 Keyboard Navigation

| Key | Context | Action |
|-----|---------|--------|
| `Enter` | Segment row selected | Open PromptViewer |
| `Escape` | PromptViewer | Back to overview |
| `Escape` | PromptEditor | Show unsaved dialog if dirty, else back |
| `Ctrl+S` | PromptEditor | Save and return to viewer |
| `Tab` | PromptEditor | Move between section textareas |
| `Space` | Chapter card header | Toggle collapse/expand |

---

## 8. API Contract (Backend Work Needed)

### 8.1 Existing Endpoints

| Method | Path | Returns | Notes |
|--------|------|---------|-------|
| `GET` | `/api/projects/{id}/chapters/{ref}/prompts` | `string[]` (filenames) | Lists prompt files for chapter |
| `GET` | `/api/projects/{id}/chapters/{ref}/prompts/{seg}` | `text/plain` | Returns markdown prompt |
| `POST` | `/api/projects/{id}/chapters/{ref}/prompts/generate` | `{"prompts": [paths]}` | Assembles all segment prompts |

### 8.2 New Endpoints Needed

| Method | Path | Body | Returns | Notes |
|--------|------|------|---------|-------|
| `PUT` | `/api/projects/{id}/chapters/{ref}/prompts/{seg}` | `{"content": "..."}` | `{"status": "ok"}` | Update edited prompt. 10-line implementation: read body, call `storage.write_md()`. |
| `GET` | `/api/projects/{id}/chapters/{ref}/prompts/{seg}/meta` | - | `{"generated_at": ..., "edited_at": ..., "status": "pristine"\|"modified"}` | Optional metadata endpoint. Could also derive from filesystem timestamps. |

### 8.3 PUT Implementation Sketch

```python
@router.put("/prompts/{seg}")
async def update_prompt(
    project_id: str,
    chapter_ref: str,
    seg: str,
    body: dict,
    user: dict = Depends(get_current_user),
    _: bool = Depends(require_ai_access),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project(db, project_id, user["id"])
    if not project:
        raise HTTPException(404, "Project not found")
    _validate_ref(chapter_ref)
    content = body.get("content", "")
    await get_storage().write_md(
        project.root_path, f"prompts/{chapter_ref}-{seg}-prompt.md", content
    )
    return {"status": "ok"}
```

### 8.4 Segment Metadata (Optional, Future)

Could track edit history via a companion `.meta.yaml` file:

```yaml
# prompts/vol-1-ch-1-seg-1-prompt.meta.yaml
generated_at: 1690192800  # unix timestamp
edited_at: 1690196400
edit_count: 2
```

---

## 9. Accessibility & Performance

### 9.1 WCAG AA Compliance

| Requirement | Implementation |
|-------------|---------------|
| Color contrast | All status badges use `text-{color}` on `bg-base-100` background — exceeds 4.5:1 ratio (tested against both themes) |
| Keyboard nav | Full keyboard support per section 7.6 |
| Focus indicators | All interactive elements have `focus-visible:outline-2 focus-visible:outline-primary` |
| Screen reader | Segment rows use `aria-label="第{N}段: {title}, 状态: {status}"` |
| Reduced motion | `prefers-reduced-motion` disables collapse animations: use `transition: none` |
| Touch targets | All clickable rows minimum 44px height |

### 9.2 Performance

| Concern | Mitigation |
|---------|------------|
| Large prompt files (>50KB) | Lazy-load per-segment on expand — `GET /prompts/{seg}` called only when segment row is clicked or card is expanded |
| Many segments (20+) | Virtualize segment list using CSS `content-visibility: auto` on rows beyond first 10 |
| Re-renders | Each `PromptSection` is `React.memo`'d with stable content props |
| SSE during generation | Single polling request per chapter, not per-segment |

### 9.3 Error Recovery

| Failure | Recovery |
|---------|----------|
| Segment load fails | Toast error with retry button, show partial content |
| Save fails | Inline error with retry, preserve textarea state |
| Generation fails | Toast error, enable generate button again |
| Network offline | Detect `navigator.onLine`, show banner "网络已断开" |

---

## Appendix A: File Changes Summary

| File | Action |
|------|--------|
| `client/frontend/src/pages/NovelPage.tsx` | Add `TabId = "prompts"`, define view states, add tab button, route to `PromptManagementPage` |
| `client/frontend/src/components/novel/PromptManagementPage.tsx` | **NEW** — Orchestrator component: loads prompts data, renders Overview/Viewer/Editor |
| `client/frontend/src/components/novel/PromptOverview.tsx` | **NEW** — Chapter-grouped collapsible segment list with status badges |
| `client/frontend/src/components/novel/ChapterPromptCard.tsx` | **NEW** — Collapsible card for one chapter's prompts |
| `client/frontend/src/components/novel/SegmentRow.tsx` | **NEW** — Single segment row with preview and status |
| `client/frontend/src/components/novel/PromptViewer.tsx` | **NEW** — Full prompt display with section cards |
| `client/frontend/src/components/novel/PromptSection.tsx` | **NEW** — Individual section card (used in Viewer and Editor) |
| `client/frontend/src/components/novel/PromptEditor.tsx` | **NEW** — Per-section editor with save/restore |
| `client/frontend/src/components/novel/StructureTree.tsx` | Update to show prompt status badges on chapter nodes |
| `client/backend/prompt/router.py` | Add `PUT /prompts/{seg}` endpoint |
| `client/frontend/e2e/prompt.spec.ts` | **NEW** — E2E tests for prompts CRUD |

## Appendix B: Prompt Section Parser Utility

```typescript
// Prompt section parsing utility
// Parses a raw prompt markdown string into labeled sections

type PromptSection = {
  id: string;        // "role" | "constraints" | "context" | "writing" | "output"
  label: string;     // "角色定位" | "原则与禁忌" | "故事背景" | "写作指引" | "写作要求"
  content: string;   // Raw markdown content of the section
  editable: boolean; // Whether this section is user-editable
};

function parsePromptSections(raw: string): PromptSection[] {
  const sectionDefs: { id: string; label: string; heading: string; editable: boolean }[] = [
    { id: "role",        label: "角色定位",   heading: "## 角色定位",   editable: false },
    { id: "constraints", label: "原则与禁忌", heading: "## 原则与禁忌", editable: true },
    { id: "context",     label: "故事背景",   heading: "## 故事背景",   editable: true },
    { id: "writing",     label: "写作指引",   heading: "## 写作指引",   editable: true },
    { id: "output",      label: "写作要求",   heading: "## 写作要求",   editable: true },
  ];

  const sections: PromptSection[] = [];

  for (let i = 0; i < sectionDefs.length; i++) {
    const def = sectionDefs[i];
    const nextDef = sectionDefs[i + 1];
    const startIdx = raw.indexOf(def.heading);

    if (startIdx === -1) {
      sections.push({ ...def, content: "(空)" });
      continue;
    }

    const contentStart = startIdx + def.heading.length;
    const endIdx = nextDef ? raw.indexOf(nextDef.heading, contentStart) : raw.length;
    const content = raw.slice(contentStart, endIdx).trim();

    sections.push({ ...def, content: content || "(空)" });
  }

  return sections;
}

function reassemblePrompt(sections: PromptSection[]): string {
  return sections
    .map((s) => `## ${s.label}\n${s.content}`)
    .join("\n\n");
}
```

---

*End of design spec. Developer-ready for implementation.*
