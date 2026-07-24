# Outline Management Page (Issue #36) -- UI Design Specification

> **Designer**: UI Designer Agent  
> **Product**: AI Novel (AI 爱小说)  
> **Target File**: `client/frontend/src/pages/OutlinePage.tsx` (new)  
> **Branch**: Phase 2, after Phase 1 API Key + Permission refactor  
> **Version**: 1.0  
> **Date**: 2026-07-24  

---

## 1. Overview

### 1.1 Purpose

The Outline Management Page is a dedicated workspace for **Phase 3 (outline)** of the 6-phase novel writing workflow. It replaces the current "章纲" textarea inside ChapterEditor with a feature-rich outline editor that matches the structure defined in the chapter YAML template.

### 1.2 Workflow Position

```
Phase 1 (Init) → Phase 2 (Settings) → Phase 3 (Outline) [THIS PAGE]
→ Phase 4 (Prompt) → Phase 5 (Write) → Phase 6 (Archive)
```

Transition out of Phase 3 requires **every chapter** to pass `gate_chapter_ready()`. The "视角转换" (perspective conversion) step is also required per chapter before prompt generation.

### 1.3 Key Data Model

Each chapter YAML stores:
```yaml
outline:
  summary: string               # 章纲概要 (from existing ChapterEditor)
  key_points: string[]          # 关键情节点
  characters: string[]           # 出场角色
  location: string              # 场景地点
  time: string                  # 时间设定
  narrative_pov: string         # 叙事视角
  perspective_guidance: string   # 视角转换指引 (AI-generated)

memo:
  current_task: string           # 本章核心任务 (textarea)
  reader_expectation:
    state: string                # 读者预期状态
    strategy: string             # 达成策略
    detail: string               # 详细说明
  payoff_plan:                   # 伏笔回收计划
    must_resolve: string[]
    must_hold: string[]
    partial_advance: string[]
  downtime_functions: string[]
  key_choices: string[]
  required_changes: string[]     # 必改项 (list)
  prohibitions: string[]

emotional_design:
  primary_mood: string           # 核心情绪基调

segments:                        # 章节段落规划 (reorderable)
  - summary: string
    target_words: number
  - summary: string
    target_words: number
```

### 1.4 Entry / Exit

**Entry**: User selects "outline" tab from the novel page tab bar, or navigates from StructureTree "outline" node.

**Exit (forward)**: "确认全部章纲" button at top-right, triggers `POST /api/projects/{id}/workflow/transition` with target `prompt`. Only enabled when all chapters pass gate.

**Exit (backward)**: Phase 2 "Settings" button or tree node click.

---

## 2. Screen 1: Outline Overview

### 2.1 Wireframe: ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [← 返回正文]                   细纲管理                      全局进度  │
│                                                              [确认全部]│
│ ┌──────────┬────────────────────────────────────────────────────────┐ │
│ │          │  已填 X/Y 章 · 已确认 X/Y 章                           │ │
│ │ Structure│  ════════════════════░░░░░░░░░░░░░░░░  45%            │ │
│ │ Tree     │                                                        │ │
│ │ (left    │ ─── 第一卷 (5章) ─── [▾]                              │ │
│ │ panel)   │ ┌────────────────────────────────────────────────────┐ │ │
│ │          │ │ 第一章 迷雾渐起                                     │ │ │
│ │          │ │ 状态: [未填]   [编辑细纲] [确认完成] [视角转换]      │ │ │
│ │          │ │ 概览: 主角在陌生城市醒来，发现自己失去了所有记忆...  │ │ │
│ │          │ └────────────────────────────────────────────────────┘ │ │
│ │          │ ┌────────────────────────────────────────────────────┐ │ │
│ │          │ │ 第二章 陌生的善意   [进行中]                       │ │ │
│ │          │ │ 状态: [进行中]   [编辑细纲] [确认完成] [视角转换]  │ │ │
│ │          │ │ 概览: 遇见神秘女子，获得第一个线索...              │ │ │
│ │          │ └────────────────────────────────────────────────────┘ │ │
│ │          │ ┌────────────────────────────────────────────────┐      │ │
│ │          │ │ ... (more chapters)                           │      │ │
│ │          │ └────────────────────────────────────────────────┘      │ │
│ │          │                                                        │ │
│ │          │ ─── 第二卷 (3章) — [▸] (collapsed)                     │ │
│ │          │                                                        │ │
│ └──────────┴────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Page Component Architecture

```
OutlinePage
├── TopBar
│   ├── BackButton ("← 返回正文")
│   ├── Title ("细纲管理")
│   ├── GlobalProgressBar (已填 X/Y 章 · 已确认 X/Y 章)
│   └── GlobalConfirmButton ("确认全部章纲")
├── SplitPanel
│   ├── LeftPanel (StructureTree)
│   └── RightPanel
│       ├── OutlineOverview (default view)
│       │   ├── ProgressHeader (per-volume)
│       │   └── VolumeList
│       │       ├── VolumeCard (collapsible)
│       │       │   ├── VolumeHeader (title + chapter count + expand)
│       │       │   └── ChapterCard (repeating)
│       │       │       ├── ChapterTitle
│       │       │       ├── ChapterSummary (1-2 line preview)
│       │       │       ├── StatusBadge
│       │       │       └── ActionRow
│       │       │           ├── EditButton ("编辑细纲")
│       │       │           ├── ConfirmButton ("确认完成")
│       │       │           └── PerspectiveButton ("视角转换")
│       │       └── EmptyState
│       └── OutlineEditor (replaces when editing)
│           └── ... (defined in Screen 2)
```

### 2.3 Component Inventory

#### 2.3.1 TopBar

| Element | Component | States |
|---------|-----------|--------|
| Back button | `button` with `← 返回正文` | default, hover (`text-primary`), active |
| Title | `h1` with `font-serif font-semibold text-lg` | static |
| GlobalProgress | See 2.3.2 | loading, normal, all-done |
| GlobalConfirm | `button.btn.btn-primary` | disabled (gate fails), enabled, loading (saving), success |

**Disabled condition for GlobalConfirm**: Any chapter has status `"未填"` or `"进行中"`, OR any confirmed chapter lacks `perspective_guidance`.

**Flow on click**: Calls `POST /api/projects/{id}/workflow/transition {target: "prompt"}`. On success, navigate to Prompt phase. On error, show toast.

#### 2.3.2 GlobalProgressBar

```
已填 3/8 章 · 已确认 2/8 章
════════════════░░░░░░░░  37%
```

A `<progress>` element styled with daisyUI:
```tsx
<progress
  className="progress progress-primary w-full max-w-xs"
  value={filledCount}
  max={totalCount}
/>
```

Text underneath: `已填 {filledCount}/{totalCount} 章 · 已确认 {confirmedCount}/{totalCount} 章`

Color tokens:
- Bar fill: `bg-primary`
- Track: `bg-base-300/50`
- Text: `text-base-content/60 text-xs`

#### 2.3.3 LeftPanel (StructureTree)

Reuse existing `StructureTree` component with outline-specific nodes:

Each tree node:
- **Volume**: icon `<Book/>`, label `"第{num}卷"`, badge `"{count}章"`
- **Chapter**: icon `<FileText/>`, label chapter title, badge color based on status (see 2.3.5)

Action buttons on chapter nodes:
- Edit: icon `<Edit3/>` or `✎`, calls `onSelect` with `{panel: "editor", chapterRef}`
- Confirm: icon `<Check/>` or toggle, same logic as ConfirmButton

**Important**: The outline page uses the SAME StructureTree component as the writing page but with different `activeNodes`. The tree nodes and the overview cards must stay in sync.

#### 2.3.4 VolumeList / VolumeCard

**Collapsible**: Each volume is a `<details>` element or custom collapsible.

- **Expanded** (default for volumes with chapters that have unset status): Shows all chapters
- **Collapsed** (default for volumes where all chapters are confirmed): Only shows summary `"第X卷 · 共N章（全部已确认）"`

Volume header row:
```tsx
<div className="flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-200/30">
  <Book className="w-4 h-4 text-primary/60" />
  <span className="text-sm font-medium text-base-content/80">{title}</span>
  <span className="text-xs text-base-content/40">{chapters.length}章</span>
  <div className="flex-1" />
  <span className="text-[10px] text-base-content/30">{volumeProgress}</span>
  <ChevronDown className={`w-4 h-4 text-base-content/30 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`} />
</div>
```

#### 2.3.5 ChapterCard

**Card layout** (repeated per chapter):

```tsx
<div className="group px-4 py-3 border-b border-base-200 hover:bg-base-200/20 transition-colors">
  <div className="flex items-start gap-4">
    {/* Left: Status indicator dot + index */}
    <div className="flex items-center gap-2 pt-0.5 shrink-0 w-8">
      <span className={`w-2 h-2 rounded-full ${statusDotColor}`} />
      <span className="text-xs text-base-content/30 tabular-nums">{index}</span>
    </div>

    {/* Middle: Content */}
    <div className="flex-1 min-w-0">
      {/* Title row */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-base-content truncate">{title}</span>
        <StatusBadge status={status} />
      </div>
      {/* Summary preview */}
      <p className="text-xs text-base-content/50 leading-relaxed line-clamp-2">
        {summary || <span className="text-base-content/20 italic">暂未填写概要</span>}
      </p>
    </div>

    {/* Right: Actions */}
    <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
      <ActionButton icon="✎" label="编辑细纲" onClick={onEdit} />
      <ConfirmToggle confirmed={status === "confirmed"} onToggle={onConfirm} />
      <ActionButton
        icon={<span className="text-[11px]">🔄</span>}
        label="视角转换"
        onClick={onPerspective}
        disabled={status !== "confirmed"}
        completed={hasPerspectiveGuidance}
      />
    </div>
  </div>
</div>
```

**Status dot colors** (mapping):

| Status | Dot Color | Text Label | Badge Class |
|--------|-----------|------------|-------------|
| `"未填"` (unfilled / new) | `bg-base-content/20` | 未填 | `badge-ghost text-base-content/30` |
| `"进行中"` (in progress) | `bg-warning` | 进行中 | `badge-warning` |
| `"已确认"` (confirmed) | `bg-success` | 已确认 | `badge-success` |

**Status derivation logic**: 
- If `outline.summary` is empty AND `memo.current_task` is empty → `"未填"`
- If `outline.summary` is non-empty OR `memo.current_task` is non-empty, but `status !== "confirmed"` → `"进行中"`
- If `status === "confirmed"` → `"已确认"`

#### 2.3.6 ActionRow Buttons

**EditButton** ("编辑细纲"):
- `btn btn-ghost btn-xs` with `✎` icon
- Default: `text-base-content/50 hover:text-primary`
- Click: navigates to Screen 2 (OutlineEditor) for that chapter
- Keyboard: Enter on focused chapter card

**ConfirmButton** (reuse `ConfirmToggle` component):
- Props: `{confirmed, onToggle}`
- When `confirmed=false`: shows "完成设定" with hover state
- When `confirmed=true`: shows "已设定" with green check, disabled, subtle glow
- Click triggers `POST /api/projects/{id}/chapters/{ref}/confirm`
- On success: updates local state, shows success toast
- On failure: shows error toast with `missing` fields from gate

**PerspectiveButton**:
- `btn btn-ghost btn-xs`
- When disabled (status !== "confirmed"): `text-base-content/20 cursor-not-allowed`
- When enabled: `text-base-content/50 hover:text-primary`
- When completed (has `perspective_guidance`): `text-success/70`
- Icon: `🔄` or custom SVG
- Label: "视角转换"
- Click: opens perspective modal (see Screen 3)

### 2.4 Empty State

When no volumes exist (project just entered outline phase):

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   📝  (icon, 48x48, text-base-content/30)                   │
│                                                              │
│   暂无细纲内容                                                │
│                                                              │
│   请先创建卷和章节，然后在此页面填写每个章节的细纲。            │
│   细纲包括核心任务、读者预期、情绪基调、段落规划等。            │
│                                                              │
│   [创建第一卷]  [回到正文]                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Reuses `EmptyState` component with appropriate props.

### 2.5 Loading State

Skeleton for the entire split-panel layout:

```
┌──────────────────────────────────────────────────────────────┐
│ [skeleton h-5 w-20]    [skeleton h-5 w-48]     [skeleton...]│
├────────────┬─────────────────────────────────────────────────┤
│ [sk h-7]   │ [sk h-10 w-full]                                │
│ [sk h-7]   │ [sk h-24 w-full]                                │
│ [sk h-7]   │ [sk h-24 w-full]                                │
│ [sk h-7]   │ [sk h-24 w-full]                                │
│            │ [sk h-10 w-full]                                │
└────────────┴─────────────────────────────────────────────────┘
```

Use existing `skeleton` CSS class from `index.css`.

### 2.6 Error State

```tsx
<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
  <AlertCircle className="w-12 h-12 text-error/60" />
  <p className="text-error text-sm">{errorMessage}</p>
  <button onClick={retryLoad} className="btn btn-ghost btn-sm">
    重试
  </button>
</div>
```

### 2.7 Edge Cases

| Case | Behavior |
|------|----------|
| 0 volumes | Show empty state with "创建第一卷" button |
| 1 chapter | Single card, no volume collapse needed |
| 50+ chapters per volume | Default collapsed for volumes > 10 chapters. Virtual scroll? No -- keep DOM simple, use overflow-y-auto on the content area. Performance is fine for typical novel (50-200 chapters total). |
| Mixed statuses (e.g., 50 chapters, 20 confirmed) | Show all unconfirmed chapters expanded. Collapse volumes where ALL chapters confirmed. |
| All confirmed | Show "全部已确认" badge on GlobalConfirm button. Disable it. |
| Network failure on confirm | Show toast error "确认失败，请重试" with retry button on the chapter card |

---

## 3. Screen 2: Outline Editor (Inline)

### 3.1 Wireframe: ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [← 返回概览]   细化章节细纲 — 第一卷·第一章_迷雾渐起                  │
│                [AI 帮我填全部]                                        │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │  TabBar: [章纲概要] [核心任务] [读者预期] [情绪设计] [段落规划]   │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │                                                                  │ │
│ │  Tab: 章纲概要 (outline fields)                                  │ │
│ │                                                                  │ │
│ │  章纲概要 [textarea]                                             │ │
│ │  关键情节点 [ListEditor]                                          │ │
│ │  出场角色 [ListEditor]                                            │ │
│ │  场景地点 [InputField]                                            │ │
│ │  时间设定 [InputField]                                            │ │
│ │  叙事视角 [InputField]                                            │ │
│ │                                                                  │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │  Tab: 核心任务 (memo.current_task)                                │ │
│ │                                                                  │ │
│ │  本章核心任务 [textarea]                                          │ │
│ │  必改项 [ListEditor]                                              │ │
│ │  禁止项 [ListEditor]                                              │ │
│ │                                                                  │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │  Tab: 读者预期 (reader_expectation)                               │ │
│ │                                                                  │ │
│ │  读者预期状态 [InputField]                                        │ │
│ │  达成策略 [InputField]                                            │ │
│ │  详细说明 [Field (textarea)]                                      │ │
│ │                                                                  │ │
│ │  伏笔回收计划:                                                   │ │
│ │  必须在本章回收 [ListEditor]                                       │ │
│ │  必须在本章保留 [ListEditor]                                       │ │
│ │  部分推进 [ListEditor]                                            │ │
│ │                                                                  │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │  Tab: 情绪设计 (emotional_design)                                 │ │
│ │                                                                  │ │
│ │  核心情绪基调 [select / input]                                    │ │
│ │  情绪曲线 [auto-generated from segments]                          │ │
│ │                                                                  │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │  Tab: 段落规划 (segments)                                         │ │
│ │                                                                  │ │
│ │  章节段落规划 (reorderable):                                      │ │
│ │  ┌─────────────────────────────────────────────────────────────┐ │ │
│ │  │ ⠿ 段落1  主线推动  主角发现线索                [500-800字]  │ │ │
│ │  │ ⠿ 段落2  冲突升级  与神秘人物对峙              [800-1000字] │ │ │
│ │  │ ⠿ 段落3  悬念收尾  留下新的疑问                [300-500字]  │ │ │
│ │  │ [+ 添加段落]                                                │ │ │
│ │  └─────────────────────────────────────────────────────────────┘ │ │
│ │                                                                  │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │  [💾 保存]  [已保存]                              [完成设定]     │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Architecture

```
OutlineEditor
├── EditorHeader
│   ├── BackButton ("← 返回概览")
│   └── ChapterTitle ("第一卷·第一章 迷雾渐起")
│   └── AIGenerateAllButton ("AI 帮我填全部")
├── TabBar (reuse from FormField.tsx)
│   ├── Tab: "章纲概要" (outline)
│   ├── Tab: "核心任务" (memo)
│   ├── Tab: "读者预期" (reader_expectation + payoff_plan)
│   ├── Tab: "情绪设计" (emotional_design)
│   └── Tab: "段落规划" (segments)
├── TabContent (switches based on activeTab)
│   ├── OutlineTab
│   │   ├── Field("章纲概要", summary) [textarea]
│   │   ├── ListEditor("关键情节点", key_points)
│   │   ├── ListEditor("出场角色", characters)
│   │   ├── InputField("场景地点", location)
│   │   ├── InputField("时间设定", time)
│   │   └── InputField("叙事视角", narrative_pov)
│   ├── MemoTab
│   │   ├── Field("本章核心任务", current_task) [textarea]
│   │   ├── ListEditor("必改项", required_changes)
│   │   └── ListEditor("禁止项", prohibitions)
│   ├── ReaderExpectationTab
│   │   ├── InputField("读者预期状态", state)
│   │   ├── InputField("达成策略", strategy)
│   │   ├── Field("详细说明", detail) [textarea]
│   │   ├── Divider
│   │   ├── ListEditor("必须在本章回收", must_resolve)
│   │   ├── ListEditor("必须在本章保留", must_hold)
│   │   └── ListEditor("部分推进", partial_advance)
│   ├── EmotionTab
│   │   ├── InputField("核心情绪基调", primary_mood) [select + custom]
│   │   └── ... (mood curve visualization, Phase 2)
│   └── SegmentsTab
│       ├── SegmentsList (reorderable)
│       │   ├── SegmentRow (repeatable)
│       │   │   ├── DragHandle ("⠿")
│       │   │   ├── SummaryInput (text input)
│       │   │   ├── TargetWordsInput (number input)
│       │   │   └── DeleteButton
│       │   └── AddButton ("+ 添加段落")
│       └── (total word count summary)
├── EditorFooter
│   ├── SaveButton (reuse from FormField.tsx)
│   ├── SaveStatus ("已保存" / "未保存" / "保存中...")
│   └── ConfirmToggle (reuse)
```

### 3.3 Tab Content Details

#### 3.3.1 Outline Tab ("章纲概要")

Reuses `Field` component for textarea, `InputField` for single-line, `ListEditor` for arrays.

**AI generate buttons**: Each field has an optional `aiGeneratable` prop that shows the "AI 帮我填" button (reuse existing from FormField.tsx).

**Auto-save**: Same pattern as ChapterEditor -- debounce 3 seconds after any change, save via PUT `/api/projects/{id}/chapters/{ref}`.

#### 3.3.2 MemoTab ("核心任务")

**current_task**: `Field` with `aiGeneratable`, hint: "用一句话描述本章主角必须完成的核心任务"
**required_changes**: `ListEditor`, hint: "列出本章中对角色关系或世界状态的永久改变"
**prohibitions**: `ListEditor`, hint: "哪些行为或剧情走向在本章中被禁止"

#### 3.3.3 ReaderExpectationTab ("读者预期")

**state**: `InputField`, hint: e.g., "读者想知道主角的真实身份"
**strategy**: `InputField`, hint: "如何通过本章内容满足上述预期"
**detail**: `Field(textarea)`, hint: "补充描述读者情绪曲线的设计"

**Payoff Plan section** (separated by divider):
```tsx
<div className="border-t border-base-300 pt-4 mt-4">
  <h4 className="text-xs font-medium text-base-content/50 mb-3 tracking-wide">
    伏笔回收计划
  </h4>
  ...
</div>
```

#### 3.3.4 EmotionTab ("情绪设计")

**primary_mood**:
- `select` element with common moods: "紧张", "悬疑", "温暖", "悲伤", "激昂", "轻松", "压抑", "浪漫", "惊悚"
- Plus custom input option
- Same styling as `InputField`
- Hint: "本章希望带给读者的核心情绪感受"

#### 3.3.5 SegmentsTab ("段落规划")

**SegmentRow**:
```tsx
<div className="flex items-center gap-3 group px-3 py-2.5 rounded-lg hover:bg-base-200/30 transition-colors border border-transparent hover:border-base-300/40">
  {/* Drag handle */}
  <span className="cursor-grab text-base-content/20 hover:text-base-content/40 select-none text-lg leading-none">
    ⠿
  </span>

  {/* Segment summary */}
  <input
    className="flex-1 bg-transparent border-none text-sm outline-none placeholder:text-base-content/20"
    value={segment.summary}
    onChange={...}
    placeholder="段落概要（如：主角发现线索）"
  />

  {/* Target word count */}
  <div className="flex items-center gap-1 shrink-0">
    <input
      type="number"
      className="w-20 bg-base-200/40 border border-base-300/60 rounded px-2 py-1 text-xs text-right outline-none tabular-nums"
      value={segment.target_words || ""}
      onChange={...}
      placeholder="字数"
      min={0}
    />
    <span className="text-[10px] text-base-content/30 w-6">字</span>
  </div>

  {/* Delete */}
  <button
    onClick={...}
    className="opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error transition-all text-sm px-1"
  >
    ✕
  </button>
</div>
```

**Reorder**: Use HTML5 Drag and Drop API (`draggable`, `onDragStart`, `onDragOver`, `onDrop`). For Phase 1, simple move-up/move-down buttons as fallback:

```tsx
<button onClick={() => moveSegment(i, i-1)} disabled={i === 0}
  className="opacity-0 group-hover:opacity-60 text-base-content/30 hover:text-base-content text-xs">
  ↑
</button>
<button onClick={() => moveSegment(i, i+1)} disabled={i === segments.length-1}
  className="opacity-0 group-hover:opacity-60 text-base-content/30 hover:text-base-content text-xs">
  ↓
</button>
```

**Add button**: `"+ 添加段落"` at bottom of list, same styling as existing ListEditor add button.

**Total summary** at bottom: `"共 {n} 段，预计 {total} 字"` in `text-xs text-base-content/40`.

### 3.4 States

#### 3.4.1 Loading State

When clicking "编辑细纲" on a chapter:

```tsx
// Inline skeleton replacing the editor
<div className="space-y-4 p-6">
  <div className="skeleton h-8 w-48" />
  <div className="skeleton h-5 w-full" />
  <div className="skeleton h-32 w-full" />
  <div className="skeleton h-32 w-full" />
  <div className="skeleton h-8 w-24" />
</div>
```

#### 3.4.2 Error State

```
┌──────────────────────────────────────────────┐
│      加载细纲失败                              │
│      网络错误或章节数据损坏                    │
│      [重试]  [返回概览]                       │
└──────────────────────────────────────────────┘
```

#### 3.4.3 Empty Tab

Tabs with no data yet show placeholder text:
- "暂未填写概要" for empty summary
- "暂无关键情节点" for empty key_points
- "暂无段落规划" for empty segments

Use `<span className="text-base-content/20 italic">` styling.

#### 3.4.4 Save State

| State | Visual | Behavior |
|-------|--------|----------|
| Saving | Button shows spinner + "保存中..." | Button disabled |
| Saved | "已保存" in `text-success/70` | Auto-clear after 2s |
| Dirty | Badge "⚠️ 未保存" in `text-warning` | Auto-save timer running |
| Error | "保存失败" in `text-error` + retry button | Click to retry |

### 3.5 Interactions

#### 3.5.1 Tab Switching
- Clicking a tab immediately switches content
- No data loss -- data is held in parent component state
- Unfilled tabs show placeholder text, not an error

#### 3.5.2 Auto-save
- 3-second debounce after ANY field change
- Same pattern as `ChapterEditor`:
  ```tsx
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => autoSave(), 3000);
    return () => clearTimeout(timer);
  }, [formData]);
  ```

#### 3.5.3 Manual Save
- "保存" button in footer
- Only enabled when `isDirty` is true
- Same styling as `SaveButton` from FormField.tsx

#### 3.5.4 AI Generate All
- "AI 帮我填全部" button in header
- Opens `AIGenerateProgress` modal with steps per field
- Each successful generation fills the corresponding field
- Partial success: filled fields stay, failed fields show error state

#### 3.5.5 Back to Overview
- "← 返回概览" navigates back to Screen 1
- If dirty, show confirm dialog: "有未保存的修改，确定返回吗？"
- If saving, wait for save to complete before navigating

#### 3.5.6 Completion Toggle
- Same behavior as existing `ConfirmToggle` in setting forms
- Click → call `POST /api/projects/{id}/chapters/{ref}/confirm`
- On 400 (gate fails): show toast with missing fields list
- On success: update status to "已确认", show success animation

---

## 4. Screen 3: Perspective Conversion Modal

### 4.1 Wireframe: ASCII Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                ╳                                                 │
│   🔄  视角转换                                                    │
│                                                                  │
│   将上帝视角的章纲转换为沉浸式第二人称写作指引。                      │
│                                                                  │
│   ─────────────────────────────────────────────────────           │
│                                                                  │
│   📄 原始章纲概要:                                                 │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │ 主角在陌生城市醒来，发现自己失去了所有记忆，                     │   │
│   │ 身上只有一张纸条和一把钥匙。他决定按照纸条上的                   │   │
│   │ 地址去寻找答案...                                          │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ✨ 转换结果:                                                     │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │ 你睁开眼，陌生的天花板映入眼帘。阳光透过廉价的                   │   │
│   │ 窗帘洒进来，你感到一阵剧烈的头痛。摸索口袋，                      │   │
│   │ 你找到了一张皱巴巴的纸条和一把生锈的钥匙。                        │   │
│   │ 纸条上的字迹模糊却清晰可辨..."                                │   │
│   └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│   [🔄 重新生成]                    [✅ 确认并保存]                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Architecture

```
PerspectiveModal (modal overlay)
├── Backdrop (click to dismiss, unless loading)
├── ModalBox
│   ├── CloseButton ("╳")
│   ├── Title ("视角转换")
│   ├── Description (explanatory text)
│   ├── OriginalSummary (read-only display)
│   ├── ConversionResult
│   │   ├── LoadingSpinner (while generating)
│   │   ├── ErrorState (on failure)
│   │   └── ResultText (markdown rendered as prose)
│   ├── Footer
│   │   ├── RegenerateButton ("重新生成")
│   │   └── ConfirmSaveButton ("确认并保存")
│   └── UsageInfo (tokens used, optional)
```

### 4.3 Data Flow

```
1. User clicks "视角转换" on a confirmed chapter
2. PerspectiveModal opens with existing summary (read-only)
3. If perspective_guidance already exists → show it immediately
4. If perspective_guidance is empty → auto-trigger generation
5. Generation: POST /api/projects/{id}/chapters/{ref}/perspective
6. Response includes: { guidance, tokens_used }
7. "确认并保存" → saves guidance to YAML, closes modal
8. "重新生成" → re-calls the API, replaces result
```

### 4.4 States

| State | Visual |
|-------|--------|
| Initial (no guidance yet) | Show original summary, show "转换中…" spinner in result area |
| Loading | Spinner in result box, "重新生成" disabled, backdrop click-through blocked |
| Success | Result text visible, both buttons enabled |
| Error | Error message in result box: `"转换失败：{reason}"` |
| Already completed | Result shows existing guidance, "确认并保存" shows "已保存" |
| Regenerating | Same as loading, existing result replaced by spinner |

### 4.5 Styling

Modal uses same pattern as existing modals:

```tsx
<div className="modal modal-open" onClick={onClose}>
  <div className="modal-box max-w-2xl" onClick={(e) => e.stopPropagation()}>
    ...
  </div>
  <div className="modal-backdrop" onClick={onClose} />
</div>
```

**Result text area**:
- `font-serif text-sm leading-relaxed whitespace-pre-wrap`
- bordered: `border border-base-300 rounded-lg bg-base-100/50`
- padded: `p-4`
- min height: `min-h-[160px]`

**Summary box**:
- Same styling but with `bg-base-200/30` and `text-base-content/50`

---

## 5. Color & Typography System

### 5.1 Theme Token Usage

All colors use daisyUI semantic tokens from the two themes (novelforge / parchment):

| Purpose | Token | Example (novelforge) |
|---------|-------|---------------------|
| Page background | `bg-base-100` | `#14100b` |
| Panel background | `bg-base-200` / `bg-base-200/30` | `#1d1812` |
| Borders | `border-base-300` / `border-base-300/60` | `#2a2118` |
| Primary text | `text-base-content` | `#d4c9b8` |
| Secondary text | `text-base-content/60` | `#d4c9b880` |
| Tertiary text | `text-base-content/40` | `#d4c9b866` |
| Accent/accent | `text-primary` / `bg-primary` | `#d4a373` |
| Warning badge | `badge-warning` | `#c9a06b` |
| Success badge | `badge-success` | `#7da87a` |
| Error text | `text-error` | `#c97a7a` |
| Hover state | `hover:bg-base-300/30` | `#2a21184d` |
| Selected state | `bg-primary/10` | `#d4a3731a` |

### 5.2 Typography Scale

| Element | Class | Size |
|---------|-------|------|
| Page title | `text-lg font-serif font-semibold` | 18px |
| Chapter title in card | `text-sm font-medium` | 14px |
| Tab labels | `text-sm` | 14px |
| Field labels | `text-xs font-medium` | 12px |
| Summary preview | `text-xs` | 12px |
| Badge text | `text-[10px]` | 10px |
| Status text | `text-xs` | 12px |
| Body/textarea | `text-sm` | 14px |

### 5.3 Spacing

| Context | Spacing |
|---------|---------|
| Card padding | `px-4 py-3` |
| Between cards | `border-b` (0 gaps, stacked) |
| Between sections | `space-y-6` |
| Tab content | `pt-4 space-y-4` |
| Footer actions | `py-3 flex items-center gap-3` |
| Icon gaps | `gap-2` / `gap-1.5` / `gap-1` |

---

## 6. Interaction Specifications

### 6.1 Click Flows

```
Flow 1: Edit a chapter outline
  Click "编辑细纲" → OutlineEditor loads → Fill fields
  → Auto-save or click "保存" → Click "← 返回概览"
  → Overview shows updated status

Flow 2: Confirm a chapter
  Fill all required fields → Click "确认完成"
  → POST /confirm → Success → Status changes to "已确认"
  → If gate fails → Toast shows missing fields

Flow 3: Perspective conversion
  Chapter confirmed → Click "视角转换" button
  → Modal opens → Auto-generates or shows existing
  → Click "确认并保存" → Guidance saved → Button shows completed

Flow 4: Global advance
  All chapters confirmed AND all have perspective_guidance
  → Click "确认全部章纲" → Transition to prompt phase
```

### 6.2 Error Recovery

| Error | Recovery |
|-------|----------|
| Network failure loading chapters | Retry button, toast "加载失败" |
| Save fails | Auto-retry once after 3s, then show "保存失败" + manual retry |
| Gate validation fails | Show toast with `missing` array, fields highlighted in editor |
| Perspective generation fails | Show error in modal, "重新生成" button |
| Global confirm fails | Show toast with first failing chapter name, scroll to it |

### 6.3 Transitions & Animations

- **Tab switching**: No animation, instant swap (data already loaded)
- **Card hover**: `hover:bg-base-200/20 transition-colors duration-150`
- **Button hover**: `hover:bg-primary/20 transition-colors duration-150`
- **Modal open**: daisyUI `modal-open` fade-in
- **Status change**: Brief scale pulse on confirm toggle (existing CSS)
- **Page enter**: Apply `animate-fade-up` class for staggered entry

### 6.4 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Navigate through interactive elements |
| `Enter` | Activate focused button / save |
| `Escape` | Close modal / back to overview |
| `Ctrl+S` | Save current outline editor |
| `↑/↓` | Navigate between chapter cards in overview |

---

## 7. Directory & File Plan

```
client/frontend/src/
├── components/novel/
│   ├── outline/
│   │   ├── OutlineOverview.tsx      # Screen 1: volume + chapter list
│   │   ├── OutlineEditor.tsx         # Screen 2: tabbed editor
│   │   ├── OutlineChapterCard.tsx    # Single chapter in overview
│   │   ├── OutlineVolumeCard.tsx     # Collapsible volume wrapper
│   │   ├── SegmentRow.tsx            # Single segment in segments tab
│   │   ├── PerspectiveModal.tsx      # Screen 3: perspective conversion
│   │   └── SegmentReorderList.tsx    # Reorderable segment list
│   └── ...
├── pages/
│   └── NovelPage.tsx                 # Add "outline" tab option
└── hooks/
    └── useOutline.ts                 # Data fetching + save logic
```

### 7.1 Component Dependencies

```
OutlinePage (parent holds state)
├── OutlineOverview
│   ├── OutlineVolumeCard (collapsible) x N
│   │   ├── OutlineChapterCard x N per volume
│   │   │   ├── StatusBadge
│   │   │   ├── ConfirmToggle (reuse)
│   │   │   └── ActionButton x 3
│   └── EmptyState (reuse)
├── OutlineEditor (shown when editing one chapter)
│   ├── TabBar (reuse from FormField.tsx)
│   ├── Field, InputField, ListEditor (reuse from FormField.tsx)
│   ├── SegmentReorderList
│   │   ├── SegmentRow x N
│   │   └── AddButton
│   ├── SaveButton (reuse from FormField.tsx)
│   └── ConfirmToggle (reuse)
└── PerspectiveModal
```

### 7.2 New API Endpoints (if not yet existing)

| Method | Path | Purpose | Exists? |
|--------|------|---------|---------|
| `GET` | `/projects/{id}/chapters/{ref}` | Get chapter data | YES |
| `PUT` | `/projects/{id}/chapters/{ref}` | Save chapter data | YES |
| `POST` | `/projects/{id}/chapters/{ref}/confirm` | Confirm chapter (+ gate check) | YES |
| `POST` | `/projects/{id}/chapters/{ref}/perspective` | Run perspective conversion | YES |
| `POST` | `/projects/{id}/workflow/transition` | Move to prompt phase | NEED CHECK |

---

## 8. Reusable Component Reference

### 8.1 Existing Components to Reuse (No Changes Needed)

| Component | File | Use |
|-----------|------|-----|
| `StructureTree` | `components/novel/StructureTree.tsx` | Left panel tree |
| `EmptyState` | `components/novel/EmptyState.tsx` | Empty volume state |
| `Field` | `components/novel/settings/FormField.tsx` | Textarea with label + AI button |
| `InputField` | `components/novel/settings/FormField.tsx` | Single-line input with label + AI |
| `ListEditor` | `components/novel/settings/FormField.tsx` | Editable list with add/remove |
| `SaveButton` | `components/novel/settings/FormField.tsx` | Save button with loading state |
| `TabBar` | `components/novel/settings/FormField.tsx` | Tab navigation bar |
| `ConfirmToggle` | `components/novel/settings/ConfirmToggle.tsx` | Completion toggle with animation |
| `AIGenerateProgress` | `components/novel/settings/AIGenerateProgress.tsx` | Multi-step AI generation progress |

### 8.2 New Components to Build

| Component | File | Responsibility |
|-----------|------|---------------|
| `OutlineOverview` | `outline/OutlineOverview.tsx` | Renders full chapter list with status |
| `OutlineVolumeCard` | `outline/OutlineVolumeCard.tsx` | Collapsible volume wrapper |
| `OutlineChapterCard` | `outline/OutlineChapterCard.tsx` | Chapter row with status + actions |
| `OutlineEditor` | `outline/OutlineEditor.tsx` | Tabbed editor for all outline fields |
| `SegmentRow` | `outline/SegmentRow.tsx` | Single segment line with drag + input |
| `SegmentOrderList` | `outline/SegmentReorderList.tsx` | Reorderable list of segments |
| `PerspectiveModal` | `outline/PerspectiveModal.tsx` | Conversion result modal |

---

## 9. Data Flow Architecture

### 9.1 State Management (React State, No Redux)

```tsx
// In OutlinePage.tsx
type ViewState =
  | { panel: "overview" }
  | { panel: "editor"; chapterRef: string }
  | { panel: "perspective"; chapterRef: string };

interface ChapterOutlineState {
  chapterRef: string;
  status: "unfilled" | "in_progress" | "confirmed";
  summary: string;
  // ... other fields from the editor
}

// State
const [viewState, setViewState] = useState<ViewState>({ panel: "overview" });
const [chapters, setChapters] = useState<Map<string, ChapterOutlineState>>();
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());
```

### 9.2 Data Loading

On mount:
1. Load all volumes + chapters via existing API
2. For each chapter, fetch full chapter data
3. Derive `status` from data content (see 2.3.5)
4. Set `expandedVolumes` to show volumes with unconfirmed chapters

### 9.3 Save Flow

Editor component uses the same pattern as ChapterEditor:
- `useEffect` with 3s debounce for auto-save
- `useRef` pattern to avoid stale closures
- Dirty tracking via initial/current comparison

---

## 10. Accessibility & Quality Checklist

- [x] All buttons have `aria-label` or visible text
- [x] Status badges use semantic color (not just color -- text label also)
- [x] Tab navigation follows logical order (left-to-right, top-to-bottom)
- [x] Focus indicators visible (daisyUI default focus ring)
- [x] Touch targets minimum 44px for action buttons
- [x] Modal traps focus when open
- [x] Escape key closes modal
- [x] Color contrast meets WCAG AA (satisfied by daisyUI themes)
- [x] Loading states shown via skeleton (not just spinner)
- [x] Error states provide retry option
- [x] Empty states provide next action guidance
- [x] All list operations (add/remove/reorder) have keyboard alternatives

---

## 11. Implementation Notes

### 11.1 Build Order

1. `useOutline.ts` hook (data fetching, status derivation, save logic)
2. `OutlineChapterCard.tsx` (single chapter with status + actions)
3. `OutlineVolumeCard.tsx` (collapsible volume wrapper)
4. `OutlineOverview.tsx` (combines cards + progress + empty state)
5. `OutlineEditor.tsx` (tabbed form with all field types)
6. `SegmentRow.tsx` + `SegmentReorderList.tsx` (reorderable segments)
7. `PerspectiveModal.tsx` (conversion display)
8. Wire into `NovelPage.tsx` as a new tab option
9. E2E tests for all three screens

### 11.2 Performance Considerations

- **Tree + cards stay in sync**: Both render from the same `chapters` state map. Editing a chapter updates the map, which updates both the tree badge and the card status.
- **Large volume (50+ chapters)**: Cards are simple DOM nodes with no virtual scrolling needed. Each card is ~8 DOM elements. 200 chapters = ~1600 elements, well within budget.
- **Lazy data loading**: Load chapter full data on demand, not all at once. Overview only needs `status` + `summary` from each chapter. Could add a lightweight `GET /projects/{id}/outline-status` endpoint later.
- **Debounced saves**: Prevent save spam during rapid editing.

### 11.3 Integration Points

- **Phase gate**: Check `project.currentPhase` before rendering. If not "outline", show redirect to appropriate phase.
- **Writing page consistency**: The `StructureTree` used in outline page should show the same volume/chapter structure as the writing page, but with outline-specific action buttons.
- **Versioning**: Saving outline changes should trigger version snapshots (existing `save_chapter` in engine.py already handles this).

---

## Appendix A: Quick Reference -- Status Mapping

| Backend `status` field | Combined logic | Display Status | Dot Color | Badge Class |
|------------------------|---------------|----------------|-----------|-------------|
| `"outline"` + empty fields | Summary empty + current_task empty | 未填 | `bg-base-content/20` | `badge-ghost` |
| `"outline"` + filled fields | Summary or current_task filled | 进行中 | `bg-warning` | `badge-warning` |
| `"confirmed"` | status is confirmed | 已确认 | `bg-success` | `badge-success` |

## Appendix B: Quick Reference -- Gate Validation Fields

Required by `gate_chapter_ready()`:

| Field | Component | Validation |
|-------|-----------|-----------|
| `memo.current_task` | Field (textarea) | Non-empty |
| `memo.reader_expectation.state` | InputField | Non-empty |
| `memo.reader_expectation.strategy` | InputField | Non-empty |
| `memo.required_changes` | ListEditor | At least 1 item |
| `emotional_design.primary_mood` | InputField (select) | Non-empty |
| `segments` | SegmentReorderList | At least 1 segment |

## Appendix C: Quick Reference -- Theme Examples

### novelforge (dark, "书房" vibe)

```
Page:        bg-base-100 (#14100b)
Panel:       bg-base-200 (#1d1812)  /  bg-base-200/30
Borders:     border-base-300 (#2a2118)
Text:        text-base-content (#d4c9b8)
Accent:      primary (#d4a373)
Selected:    bg-primary/10 (#d4a3731a)
Hover:       hover:bg-base-300/30
```

### parchment (light, "羊皮纸" vibe)

```
Page:        bg-base-100 (#faf6ee)
Panel:       bg-base-200 (#f0e8d8)  /  bg-base-200/30
Borders:     border-base-300 (#e0d5c0)
Text:        text-base-content (#3d352a)
Accent:      primary (#8b6914)
Selected:    bg-primary/10 (#8b69141a)
Hover:       hover:bg-base-300/30
```
