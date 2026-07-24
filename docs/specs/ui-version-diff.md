# Version Diff — UI Design Spec

> **Component**: `VersionDiff` (replaces placeholder in `VersionHistory`)
> **Stack**: daisyUI 4 + Tailwind CSS 3 + React 19 + `diff` (npm)
> **Themes**: `novelforge` (dark) / `parchment` (light)
> **Issue**: [#40](https://github.com/modoojunko/ai-novel/issues/40)

---

## 1. Component Tree

```
VersionDiff
├── VersionSelector
│   ├── OldVersionSelect (dropdown, label "旧版本")
│   └── NewVersionSelect (dropdown, label "新版本")
├── DiffToolbar
│   ├── DiffModeToggle (line / word toggle)
│   └── StatsBadge ("+12 -5")
├── DiffView
│   ├── DiffLine (repeated)
│   │   ├── LineNumber (optional gutter)
│   │   ├── DiffMarker (± symbol)
│   │   └── DiffContent
│   └── ContextLine (repeated, dimmed)
└── EmptyState / ErrorState / LoadingState
```

---

## 2. State Matrix

| State | Trigger | Visual |
|---|---|---|
| **Loading** | Fetching version metadata | Spinner in selector area + skeleton lines in diff area |
| **Empty (no versions)** | `versions.length === 0` | Dashed border area with icon + "暂无版本记录" |
| **Error (fetch failed)** | API error on version content fetch | Inline error banner with retry button |
| **Normal (diff ready)** | Two versions selected, diff computed | Split/diff view with colored lines |
| **Identical versions** | Old === New (content same) | "两个版本内容一致，无差异" — muted info banner |
| **Very long text** | prose > 5000 chars | Collapsed by default with "展开全部 N 行" (virtual scroll / line limit) |
| **Only one version** | `versions.length === 1` | Disabled selector — "需要至少两个版本才能对比" |

---

## 3. Version Selector

### Layout
- Two stacked dropdowns inside a bordered container, side-by-side on wider screens (`sm:flex-row`).
- Labels: "旧版本" (left) / "新版本" (right).
- Auto-select default: old = second-to-last version, new = last version (current).
- Each `<select>` uses daisyUI `select select-bordered select-sm`.

### Items
- Option format: `v{timestamp} — {date} [{comment}]`
- The version with `isCurrent: true` is marked with suffix ` [当前]`.

### States
- **Disabled**: only one version exists → tooltip "需要至少两个版本才能对比", selector grayed out.
- **Active**: click changes selection → triggers diff recomputation immediately.
- **Empty options**: dropdown shows "无可用版本" item.

---

## 4. Diff Mode Toggle

- Segmented button (daisyUI `join`): **"行对比"** | **"词对比"**
- Default: **行对比** (line-level diff).
- Line-level: faster, shows added/removed lines.
- Word-level: slower (~O(n*m) for `diffWords` on long text), highlights intra-line changes.
- Toggle stored as local state, persists for the component session only.

---

## 5. Diff View — Visual Style

### Color System (Token Mapping)

For both themes, the diff palette uses **success/error** semantics mapped to daisyUI's built-in `success` and `error` tokens, with custom background and border variants that match each theme's tonal range.

#### novelforge (dark — warm earth tones)

| Element | Tailwind class | Hex |
|---|---|---|
| Addition background | `bg-success/15` | `#7da87a` at 15% opacity |
| Addition left border | `border-l-2 border-success` | `#7da87a` |
| Addition line number | `text-success` | `#7da87a` |
| Addition marker | `text-success` green `+` | — |
| Deletion background | `bg-error/15` | `#c97a7a` at 15% opacity |
| Deletion left border | `border-l-2 border-error` | `#c97a7a` |
| Deletion line number | `text-error` | `#c97a7a` |
| Deletion marker | `text-error` red `-` | — |
| Unchanged text | `text-base-content/50` | 50% opacity |
| Context line number | `text-base-content/30` | 30% opacity |
| Word-level add (inline) | `bg-success/25 rounded px-0.5` | darker highlight |
| Word-level del (inline) | `bg-error/25 rounded px-0.5 line-through` | darker highlight + strikethrough |

#### parchment (light — warm paper)

| Element | Tailwind class | Hex |
|---|---|---|
| Addition background | `bg-success/15` | `#5a8a5a` at 15% opacity |
| Addition left border | `border-l-2 border-success` | `#5a8a5a` |
| Addition marker | `text-success` green `+` | — |
| Deletion background | `bg-error/15` | `#b85a5a` at 15% opacity |
| Deletion left border | `border-l-2 border-error` | `#b85a5a` |
| Deletion marker | `text-error` red `-` | — |
| Unchanged text | `text-base-content/50` | 50% opacity |
| Word-level add (inline) | `bg-success/20 rounded px-0.5` | soft green highlight |
| Word-level del (inline) | `bg-error/20 rounded px-0.5 line-through` | soft red + strikethrough |

### Line Structure

Each rendered line is a flex row:

```
[±] [line content]
```

- Gutter with `+` / `-` / ` ` (space) occupies fixed width (--space-6).
- Content area fills remaining width, `whitespace-pre-wrap` to preserve prose line breaks.
- Context lines (3 surrounding unchanged lines per change block) shown at 50% opacity.
- Long lines wrap naturally (no scroll, `break-words`).

### Stats Badge

Right-aligned above the diff view, after the mode toggle:

```
+12 lines  -5 lines
```

- Added lines count: `text-success` label.
- Deleted lines count: `text-error` label.
- Appears only when diff is active.

---

## 6. Edge Cases

### Identical Versions
- Diff view shows a centered info box:
  ```
  [Info icon] 两个版本内容一致，无差异
  ```
- No red/green rendering.
- Selector remains functional for switching.

### Very Long Text (>5000 chars)
- Diff view collapses to first 100 lines.
- Bottom of collapsed view shows a "展开全部" link:
  ```
  [只显示前 100 行]  展开全部
  ```
- Click "展开全部" removes the limit.
- Word-level diff on very long text shows a loading spinner while computing (use `useDeferredValue` + `useMemo`).

### New Version Has No Content
- If selected version's prose is empty string or null, show placeholder:
  ```
  [Info icon] 该版本无内容可对比
  ```

---

## 7. Accessibility

| Requirement | Implementation |
|---|---|
| **Color not sole indicator** | Each diff line has a `+` / `-` / ` ` symbol prefix. No colored line without symbol. |
| **Focus order** | Old select → New select → Mode toggle → Diff view (tabindex 0 on the container, arrow keys for scrolling) |
| **Screen reader** | `aria-label="版本差异对比"` on the diff container. Each diff line has `aria-label="新增"` / `"删除"` / `"未改动"`. |
| **Keyboard scroll** | Diff container is a focusable `div` with `tabIndex={0}`, scrollable via arrow keys. |
| **Reduced motion** | No animations on diff display (instant render). Toggle between modes has no transition. |
| **Touch targets** | Select elements are native `<select>` (minimum 44px height). Toggle buttons have `min-h-[44px]`. |
| **Color contrast** | Success text (`#7da87a` on `#14100b`): ratio 6.1:1 (novelforge). Error text (`#c97a7a` on `#14100b`): ratio 4.9:1 (novelforge). Both pass WCAG AA. |

---

## 8. Backend Requirement (NEW)

The existing `GET /versions` endpoint returns metadata only (no prose content). The diff needs actual prose.

**Add one of:**

### Option A: `GET /versions/{version_id}/content` (preferred)

```
GET /api/projects/{project_id}/chapters/{chapter_ref}/versions/{version_id}/content

Response 200:
{
  "version": "v1742800001",
  "time": 1742800001,
  "comment": "第二稿",
  "prose": "很久很久以前..."
}
```

### Option B: Include prose in version list response

Modify `list_versions` to include `prose` field. Simpler but heavier payload. Not preferred because most of the time the user is browsing the list, not diffing.

**Implementation guidance for backend team**:
- Use `get_storage().read_yaml()` like `restore_version` does.
- Return the same structure but without the `snapshot` nesting — flatten `snapshot.prose` to `prose`.

---

## 9. npm Dependency

Add to `client/frontend/package.json`:

```json
"dependencies": {
  "diff": "^7.0.0"
}
```

Type definitions included (`@types/diff` is bundled with the package since v5+).

**Usage sketch:**

```typescript
import { diffLines, diffWords } from "diff";

// Line-level
const changes = diffLines(oldText, newText);
// changes: Array<{ value: string; added?: boolean; removed?: boolean; count?: number }>

// Word-level
const changes = diffWords(oldText, newText);
```

---

## 10. Integration with Existing VersionHistory

### What Changes in VersionHistory.tsx

1. Keep the existing version table and restore button as-is.
2. Replace lines 131-151 (the diff section placeholder) with:

```tsx
{versions.length >= 2 && (
  <div className="mt-10">
    <h3 className="text-base font-medium text-base-content mb-3 flex items-center gap-1.5">
      <GitCompareArrows className="w-4 h-4" />
      差异对比
    </h3>
    <VersionDiff
      projectId={projectId}
      chapterRef={chapterRef}
      versions={versions}
    />
  </div>
)}
```

3. Import `VersionDiff` from a new file `VersionDiff.tsx` in the same directory.

### File Structure

```
components/novel/
├── VersionHistory.tsx   (modified — imports VersionDiff)
└── VersionDiff.tsx      (new — 250-350 lines)
```

---

## 11. Component Props

```typescript
interface VersionDiffProps {
  projectId: string;
  chapterRef: string;
  versions: Version[];  // already fetched by parent
}

interface Version {
  version: string;
  time: number;
  comment: string;
  isCurrent: boolean;
}
```

The component fetches prose content internally (via the new backend endpoint) when the selected versions change.

---

## 12. Coding Notes (for Frontend Developer)

### Performance
- Compute diffs in `useMemo` keyed on `[oldProse, newProse, diffMode]`.
- For word-level diff on prose > 3000 chars, show a spinner overlay while computing (use `useDeferredValue` + concurrent rendering).
- Use `React.memo` on individual diff line components to avoid re-rendering unchanged lines.

### Library choice for `diff`
- `diff` npm package is pure JS, zero dependencies, tree-shakeable.
- Import only the functions needed: `diffLines`, `diffWords`.
- Word-level diff on CJK text works correctly because `diffWords` splits on word boundaries that include whitespace; CJK characters are treated as individual tokens, which produces acceptable visual results for Chinese prose.

### Edge: file size
- If old/new prose content exceeds 50KB each, bail out to line-level only (disable word-level toggle with tooltip "内容过长，仅支持行级对比").

### Empty / null prose
- Coerce `oldText` and `newText` to empty string if null/undefined before passing to diff functions.

---

## 13. Visual Mock (ASCII Wireframe)

```
┌────────────────────────────────────────────┐
│  差异对比                                    │
│                                              │
│  ┌─────────────┐   ┌─────────────┐          │
│  │ v1742800001 ▼│   │ v1742800005 ▼│  [当前] │
│  │ 2025-03-24   │   │ 2025-03-25   │          │
│  └─────────────┘   └─────────────┘          │
│                                              │
│  [行对比 | 词对比]           +12 lines -5   │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ + │ 他在黄昏时分抵达了那座小镇。         │  │
│  │ - │ 他在午后时分抵达了那座小镇。         │  │
│  │   │ 镇口的老槐树下坐着几个乘凉的老人。    │  │
│  │ + │ 他们的目光中透着好奇与打量。         │  │
│  │   │ "年轻人，"其中一个开口道，           │  │
│  │   │ "你从哪里来？"                       │  │
│  │ - │ "北方。"他简短地回答。                │  │
│  │ + │ "北方。"他简短地回答，继续赶路。      │  │
│  └────────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

## 14. QA Checklist

| Check | Pass/Fail |
|---|---|
| Spinner shows while loading version content | |
| Error state shows retry button | |
| Identical versions show info banner, not red/green | |
| Empty prose shows placeholder message | |
| Line-level diff shows only full-line changes | |
| Word-level diff shows intra-line highlights | |
| Context lines (3) surround each change block | |
| +/- symbols present on every changed line | |
| Keyboard tab order: select → toggle → diff | |
| Screen reader announces line type | |
| novelforge theme has correct green/red tones | |
| parchment theme has correct green/red tones | |
| Very long text collapse triggers at 5000 chars | |
| Collapse shows "展开全部" option | |
| Only 1 version → selector grayed out | |
| Toggle between modes preserves scroll position | |
