# Archives Reader -- UI Design Spec

> **Issue**: [#37 P0: Archive browser + reader for Phase 6](https://github.com/modoojunko/ai-novel/issues/37)
> **Design System**: daisyUI 4 + Tailwind CSS 3 + React 19
> **Themes**: `novelforge` (dark) / `parchment` (light)
> **Status**: Ready for implementation
> **Estimated Frontend**: ~3.5 days

---

## 1. Overview

### What We Are Building

Two connected screens that together form the **Archive Reader**, giving users a read-only view into their completed (archived) novel chapters:

| Screen | Purpose | Route |
|---|---|---|
| **Archive Browser** | Browse all archived chapters grouped by volume. Each item shows title, word count, archive date, and an AI-generated summary. Supports search/filter. | `/project/:slug/archives` |
| **Archive Reader** | Clean, distraction-free reading view for a single archived chapter. Renders Markdown prose at a comfortable ~70ch measure. Provides prev/next navigation and a progress indicator. | `/project/:slug/archives/:filename` |

### Design Principles

1. **Reading comfort is the #1 priority.** The reader uses the same `renderMarkdown` pipeline as the ChapterEditor preview, plus optimised typography (serif font, generous leading, warm ink-on-paper feel).
2. **2 clicks max between reader and editor.** Every archive item provides a one-click "Edit in Editor" action that opens the corresponding chapter in the writing workspace.
3. **Reuse over rebuild.** The Archive Reader reuses the existing `renderMarkdown()` function from `ChapterEditor.tsx`, the `api` client from `lib/api.ts`, and daisyUI structural patterns already established in `VersionHistory.tsx` and `RightToolbar.tsx`.

### Data Flow

```
[Backend]                          [Frontend]
  GET /archives/                   --> Filename list ["vol-1-ch-3-*.md", ...]
  GET /chapters/{chapterRef}       --> Title, archive_summary, status (parallel)
  GET /archives/{filename}         --> Full Markdown content (when reading)
```

The list endpoint returns only filenames (e.g. `vol-1-ch-3-the-beginning.md`). The frontend parses the `vol-{N}-ch-{M}` prefix to derive the `chapterRef`, then fetches chapter YAML metadata in parallel to populate each card (title, summary, word count).

> **API note**: The current `GET /archives` returns bare filenames. For optimal UX, consider a `GET /archives/metadata` endpoint that returns enriched data (title, word_count, archive_date, summary) in a single call, eliminating the N+1 pattern described above. This design spec works with either approach.

---

## 2. Route and Architecture

### Route Structure (in `App.tsx`)

Replace the existing placeholder redirect at `line 38`:

```
<!-- BEFORE -->
<Route path="archives" element={<Navigate to=".." replace />} />

<!-- AFTER -->
<Route path="archives" element={<ArchivePage />} />
<Route path="archives/:filename" element={<ArchiveReader />} />
```

### Component Tree

```
ProjectLayout (AuthGuard)
  └── NovelPage
        ├── [existing] StructureTree
        ├── [existing] ChapterEditor / VolumeEditor / EmptyState
        └── (when tab="archives")
              └── ArchivePage            ← NEW
                    ├── ArchiveBrowser   ← NEW (list/group/filter)
                    │     └── ArchiveCard × N
                    └── ArchiveReader    ← NEW (reader view)
                          └── (reuses renderMarkdown from ChapterEditor)
```

### Tab Integration

A third tab ("归档") is added to the NovelPage top bar alongside "设定" and "正文":

```
[ 设定 ] [ 正文 ] [ 归档 ]
```

When the "归档" tab is active:
- The left sidebar (StructureTree) is **hidden** -- the archive view is full-width within the content area.
- The `viewState` type is extended: `{ tab: "archives" }` for the browser list, and `{ tab: "archives"; filename: string }` for the reader view.

---

## 3. Screen 1: Archive Browser

### 3.1 ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ [← 返回项目]                  归档 [23章]                         │
│                                                                    │
│ ┌─ Search ───────────────────────────────────────────────────────┐ │
│ │ 🔍 搜索章节标题...                    [仅显示新归档]  [排序 ▼] │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ── 第一卷 (8章) ──────────────────────────────────────────────── │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ 第3章: 初遇                          📅 2026-07-20  📝 2,840字│  │
│ │ 阿黄在村口遇见了那个背着古琴的男人。他看起来不像本地人...    │  │
│ │ [🆕] [📖 阅读] [✏️ 编辑]                                     │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ 第4章: 夜谈                          📅 2026-07-21  📝 3,120字│  │
│ │ 夜里，两人坐在院子里喝茶。男人说他来自遥远的京城...          │  │
│ │ [📖 阅读] [✏️ 编辑]                                           │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ ── 第二卷 (5章) ──────────────────────────────────────────────── │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ 第1章: 启程                          📅 2026-07-22  📝 3,560字│  │
│ │ 天还没亮，阿黄就收拾好了行囊...                              │  │
│ │ [📖 阅读] [✏️ 编辑]                                           │  │
│ └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Inventory

#### `ArchivePage` (page container)

- **Role**: Top-level component, fetches archive list, manages browser vs. reader sub-views.
- **Props**: `projectId: string; onBack: () => void`

#### `ArchiveBrowser` (list view)

- **Role**: Groups archives by volume, renders search/filter bar + volume section headers + card list.
- **Props**: `archives: ArchiveItem[]; projectId: string; onRead: (filename: string) => void; onEdit: (chapterRef: string) => void`

#### `ArchiveCard` (single archive item)

- **Role**: Displays title, summary, word count, date, and action buttons.
- **Props**: `item: ArchiveItem; isNew: boolean; onRead: () => void; onEdit: () => void`

#### Data type

```typescript
interface ArchiveItem {
  filename: string;          // e.g. "vol-1-ch-3-the-beginning.md"
  chapterRef: string;        // e.g. "vol-1-ch-3"  (parsed from filename)
  volume: number;            // extracted from filename
  chapter: number;           // extracted from filename
  title: string;             // from chapter YAML
  wordCount: number;         // computed from archive content or from chapter YAML
  archiveDate: string;       // file modification date or chapter timestamp
  summary: string;           // archive_summary from chapter YAML
  isNew: boolean;            // archived within last 7 days
}
```

#### Components reused or referenced

| Component | Source | Usage |
|---|---|---|
| `skeleton` | daisyUI | Loading placeholders for cards and groups |
| `badge` | daisyUI | "新" indicator, volume chapter count |
| `card` | daisyUI | Each archive item container |
| `input` + `join` | daisyUI | Search bar with filter dropdown |
| `btn-ghost` / `btn-primary` / `btn-sm` | daisyUI | Action buttons |
| `Search` / `BookOpen` / `BookMarked` / `Clock` / `FileText` / `ArrowLeft` / `Sparkles` / `ExternalLink` | lucide-react | Icons |
| `api.get()` | `lib/api.ts` | Data fetching |

### 3.3 All States

#### 3.3.1 Loading State (Skeleton)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [← 返回项目]                  归档                                  │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░           ░░░░  ░░░░              │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ── ░░░░░░░ (░░章) ────────────────────────────────────────────── │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░     ░░░░░░░░  ░░░░░░              │  │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │  │
│ │ [░░░░] [░░░░]                                                │  │
│ └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░     ░░░░░░░░  ░░░░░░              │  │
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    │  │
│ │ [░░░░] [░░░░]                                                │  │
│ └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation**: Use daisyUI `skeleton` class with `animate-pulse`. Show 2-3 card skeletons per volume group, 1-2 volume group headers. The skeleton mimics the final layout exactly.

#### 3.3.2 Empty State (No Archives)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [← 返回项目]                  归档                                  │
│                                                                    │
│                                                                    │
│              📖                                                     │
│         还没有已归档的章节                                           │
│         完成写作后点击"归档"按钮，章节会出现在这里                    │
│                                                                    │
│              [ 回到正文 ]                                           │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

- **Icon**: `BookMarked` from lucide-react, 64x64, `opacity-30 text-base-content/40`
- **Heading**: `text-xl font-serif` = "还没有已归档的章节"
- **Subtext**: `text-sm text-base-content/50 max-w-sm text-center` = guidance message
- **CTA Button**: `btn btn-primary btn-sm` → navigates to writing tab
- Reuses the pattern from `EmptyState.tsx` (same layout, different text and icon)

#### 3.3.3 Error State

```
┌─────────────────────────────────────────────────────────────────────┐
│ [← 返回项目]                  归档                                  │
│                                                                    │
│              ⚠️                                                     │
│          加载归档列表失败                                            │
│          无法连接到服务器，请检查网络后重试                           │
│                                                                    │
│              [ 重试 ]                                               │
│                                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

- **Icon**: circle alert, `text-error`, 48x48
- **Message**: `text-sm text-error` with the error detail
- **CTA**: `btn btn-ghost btn-sm` triggers `loadArchives()` retry
- Matches the error pattern from `ChapterEditor.tsx` (same retry button placement)

#### 3.3.4 Normal State (With Archives)

See the wireframe in 3.1. Key detail: volume groups are collapsed by default if there are more than 3 volumes. A "展开全部" link appears at the bottom.

#### 3.3.5 Edge Cases

| Case | Behavior |
|---|---|
| Single volume, many chapters (20+) | Volume header stays. Cards stack naturally. No pagination -- archive lists are expected to be tens, not hundreds of items (novels average 20-60 chapters). |
| Archive filename doesn't match `vol-N-ch-M` pattern | Gracefully parse what you can. If regex fails, show filename as title fallback. Mark the card with a subtle dashed border to indicate incomplete metadata. |
| Network request for chapter metadata fails for 1 item | Renders that card without summary/word count, shows `text-base-content/30` placeholder text "元数据加载失败". Other cards unaffected. |
| Zero search results | Shows inline empty state within the list: `"没有找到匹配 "{query}" 的章节"` with a clear search button. |
| Archive file exists but chapter YAML was deleted | Card renders with filename-derived title only, no summary, greyed-out "阅读" button still works (reader fetches content directly). |

### 3.4 Interaction Details

#### Section 3.4.1 Volume Group Header

```
── 第一卷 (8章) ────────────────────────────────────────────
```

- `text-xs uppercase tracking-wider text-base-content/40 font-medium`
- Clicking the header **collapses/expands** the volume group (persists state via `useState<Set<string>>`)
- Badge shows "N章" in `badge-ghost badge-sm`

#### Section 3.4.2 Search Bar

```
┌─ Search ───────────────────────────────────────────────────────────┐
│ 🔍 搜索章节标题...                    [仅显示新归档]  [排序 ▼]    │
└────────────────────────────────────────────────────────────────────┘
```

- **Search input**: `input input-bordered input-sm w-full` inside a `join` group
- **Clear button**: appears when search text is non-empty (X icon)
- **"仅显示新归档" toggle**: `toggle toggle-sm` with label "新归档" -- filters to items with `isNew === true`
- **Sort dropdown**: `select select-bordered select-sm` with options:
  - "按时间降序" (default, newest first)
  - "按时间升序"
  - "按卷排序" (grouped by volume)
- Debounce search input by 300ms before filtering

#### Section 3.4.3 ArchiveCard Actions

| Button | Position | Style | Action |
|---|---|---|---|
| "新" badge | Top-left of card | `badge badge-accent badge-sm` | Shown if `isNew === true` (archived within last 7 days) |
| "阅读" | Card bottom | `btn btn-primary btn-xs` | Calls `onRead()` which navigates to reader view |
| "编辑" | Card bottom | `btn btn-ghost btn-xs` | Calls `onEdit()` which switches to writing tab and opens the chapter in ChapterEditor |
| Date + word count | Card top-right | `text-xs text-base-content/40` | Always visible |

#### Section 3.4.4 URL Updates

- Selecting an archive card to read navigates to `/project/:slug/archives/:filename`
- The browser view is at `/project/:slug/archives`
- Browser back button returns from reader to browser

---

## 4. Screen 2: Archive Reader

### 4.1 ASCII Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│ [← 归档列表]    第一卷 · 第3章 · 初遇          [✏️ 编辑]  [全文]  │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│                                                                     │
│                        第3章: 初遇                                  │
│                                                                     │
│            阿黄在村口遇见了那个背着古琴的男人。他看起来              │
│        不像本地人，身上穿着洗得发白的青衫，脚上一双布鞋             │
│        已经磨破了边。                                              │
│                                                                     │
│            "请问，"男人朝他微微一笑，"这里是青石村吗？"             │
│                                                                     │
│            阿黄点了点头。他今年十七岁，在这个村子里                   │
│        生活了十七年，从来没见过这么好看的人。                       │
│                                                                     │
│            "我找一个人，"男人说，"他叫阿黄。"                      │
│                                                                     │
│            阿黄愣了愣，"我就是。"                                   │
│                                                                     │
│            男人上下打量了他一番，眼神里有种说不清道不明              │
│        的东西。良久，他叹了口气：                                   │
│                                                                     │
│            "你爹让我来接你。"                                       │
│                                                                     │
│            "我爹？"阿黄更糊涂了，"我爹早死了。"                     │
│                                                                     │
│            男人摇了摇头，"他没死。他一直在京城等你。"               │
│                                                                     │
│                                                                     │
│─────────────────────────────────────────────────────────────────────│
│                    ◀ 上一章   2,840 / 15,600 字   下一章 ▶         │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Inventory

#### `ArchiveReader` (reader view)

- **Role**: Renders a single archived chapter in a clean, distraction-free layout.
- **Props**: `projectId: string; filename: string; chapterRef: string; onBack: () => void; onEdit: (chapterRef: string) => void`

#### Internal sub-components (all co-located in `ArchiveReader.tsx`):

| Sub-component | Purpose |
|---|---|
| `ReaderToolbar` | Top bar: back button, breadcrumb, action buttons |
| `ReaderContent` | Prose rendering area (~70ch centered) |
| `ReaderFooter` | Bottom nav bar: prev/next, word count, progress |
| `ProgressBar` | Thin visual indicator at the very top of the reading area |

#### Data type

```typescript
interface ArchiveContent {
  filename: string;
  content: string;       // Raw Markdown content from backend
}
```

### 4.3 All States

#### 4.3.1 Loading State

The reader content area shows a centered spinner:

```
┌─────────────────────────────────────────────────────────────────────┐
│ [← 归档列表]    第一卷 · 第3章 · 初遇              [✏️ 编辑]       │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│                          ◌ (spinner)                                │
│                        加载中...                                     │
│                                                                     │
│                                                                     │
│─────────────────────────────────────────────────────────────────────│
│                  ◀ 上一章             下一章 ▶                      │
└─────────────────────────────────────────────────────────────────────┘
```

- Top bar and bottom nav render immediately (using `chapterRef` to derive title from already-loaded metadata)
- Content area shows `loading loading-spinner loading-lg text-primary`
- The progress bar is a `skeleton h-1 w-full`

#### 4.3.2 Error State

```
┌─────────────────────────────────────────────────────────────────────┐
│ [← 归档列表]    第一卷 · 第3章 · 初遇              [✏️ 编辑]       │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│                      ⚠️ 加载失败                                   │
│              归档文件可能已被删除或损坏                               │
│                                                                     │
│                    [ 重试 ]  [ 返回列表 ]                           │
│                                                                     │
│─────────────────────────────────────────────────────────────────────│
│                  ◀ 上一章             下一章 ▶                      │
└─────────────────────────────────────────────────────────────────────┘
```

- `text-error` for icon and message
- Two CTAs: retry and back to list
- If the error is a 404, show specific messaging: "此归档文件不存在或已被删除"

#### 4.3.3 Empty Content

```
┌─────────────────────────────────────────────────────────────────────┐
│ [← 归档列表]    第一卷 · 第3章 · 初遇              [✏️ 编辑]       │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│                    📄                                               │
│                   此章节暂无可读内容                                 │
│              归档时正文为空，无法显示阅读内容                         │
│                                                                     │
│─────────────────────────────────────────────────────────────────────│
│                  ◀ 上一章             下一章 ▶                      │
└─────────────────────────────────────────────────────────────────────┘
```

- Triggers when `content` is empty string after successful API call
- The `renderMarkdown()` function already handles `null`/`empty` by returning `'<p class="text-base-content/40">暂无内容</p>'`. For the reader, show a centered empty state instead.

#### 4.3.4 Normal State

Full reading layout as shown in the wireframe (section 4.1).

#### 4.3.5 Edge Cases

| Case | Behavior |
|---|---|
| Very long chapter (10,000+ words) | Content scrolls naturally. Progress bar updates based on scroll position. |
| First chapter in volume (prev disabled) | "上一章" button is `disabled` with `opacity-30 cursor-not-allowed` |
| Last chapter in project (next disabled) | "下一章" button is disabled. Show text "已是最后一章" in tooltip. |
| Chapter title is missing/filename-derived | Top bar shows filename as fallback: `{volume} · 第{chapter}章` |
| Markdown contains HTML | `renderMarkdown()` already escapes HTML (see `ChapterEditor.tsx` line 59-61) |
| Chapter was archived but YAML metadata is missing | Reader still works (content comes from `.md` file directly). Top bar uses filename-derived title. |
| Window resized while reading | Reader is fully responsive -- 70ch max-width with `mx-auto`, fluid padding |

### 4.4 Reading Comfort Specifications

```
Max-width:            ~70ch (optimal line length for Chinese prose)
Font:                 font-serif (Noto Serif SC in novelforge, serif fallback)
Font size:            text-base (16px) on desktop, text-sm (14px) on mobile
Line height:          leading-[2] (2.0, matching ChapterEditor preview)
Paragraph gap:        margin-bottom of <p> equals 1 line (inherited from prose styles)
Color:                text-base-content on bg-base-100 (high contrast, WCAG AA)
First-line indent:    none (block paragraphs with spacing between them)
Hyphenation:          none (Chinese text doesn't hyphenate)
Scrollbar:            thin, matches theme (scrollbar-thin or daisyUI default)
Selection color:      default browser selection (already matches theme via daisyUI)
```

The reader **reuses** the same prose styles already defined in `ChapterEditor.tsx`:

```tsx
// From ChapterEditor.tsx (preview mode):
className="font-serif text-base leading-[2] text-base-content prose-headings:font-serif prose-headings:text-xl prose-headings:mt-8 prose-headings:mb-4"
```

Wrapped in `max-w-[70ch] mx-auto` for line-length control.

### 4.5 Interaction Details

#### 4.5.1 Reader Toolbar

```
[← 归档列表]    第一卷 · 第3章 · 初遇          [✏️ 编辑]  [全文]
```

- **Back button**: `btn btn-ghost btn-sm` with `ArrowLeft` icon. Navigates to `/project/:slug/archives`.
- **Breadcrumb**: `text-sm text-base-content/70` showing "第N卷 · 第N章 · 标题". Formatted as a cohesive label, not clickable links.
- **"编辑" button**: `btn btn-ghost btn-xs` with `ExternalLink` icon. Switches to writing tab and opens this chapter in ChapterEditor (2 clicks: archive → editor).
- **"全文" toggle**: `btn btn-ghost btn-xs` -- scrolls to top, shows the entire chapter in one continuous view (vs. the default scroll behavior).

#### 4.5.2 Progress Bar

A thin, fixed bar spanning the full width at the very top of the reading content:

```tsx
<div className="h-1 bg-base-200 w-full rounded-full overflow-hidden">
  <div
    className="h-full bg-primary transition-all duration-300"
    style={{ width: `${scrollProgress}%` }}
  />
</div>
```

- Calculated from `scrollTop / (scrollHeight - clientHeight)` in the content container ref
- Only visible when scrolling is possible (content exceeds viewport)
- Smooth CSS transition on width changes

#### 4.5.3 Reader Footer

```
◀ 上一章   2,840 / 15,600 字   下一章 ▶
```

- **Prev/Next buttons**: `btn btn-ghost btn-sm`. Navigate between archives in the same project (not just the same volume -- though volume-adjacent items are prioritised).
- **Word count**: `text-xs text-base-content/40 tabular-nums`. Shows current chapter word count / total project archived word count.
- Navigation wraps: from the last archive, "下一章" returns to the browser view with a tooltip "已是最后一章，返回列表".
- The navigation order follows the project's chapter numbering (vol-1-ch-1 → vol-1-ch-2 → ... → vol-2-ch-1).

#### 4.5.4 Keyboard Shortcuts

| Key | Action |
|---|---|
| `←` (ArrowLeft) | Navigate to previous archive |
| `→` (ArrowRight) | Navigate to next archive |
| `Escape` | Return to archive browser |
| `e` | Open in editor (switch to writing tab) |

Keyboard events are attached to the reader content container via `onKeyDown`, with a `useEffect` + `window.addEventListener('keydown', ...)`.

---

## 5. Theme Token Map

### Both themes (`novelforge` / `parchment`)

| Design Element | Tailwind/daisyUI Token | Purpose |
|---|---|---|
| Page background | `bg-base-100` | Card and reader backgrounds |
| Text color (primary) | `text-base-content` | Chapter titles, breadcrumb labels |
| Text color (meta) | `text-base-content/40` or `text-base-content/50` | Dates, word counts, secondary labels |
| Text color (disabled) | `text-base-content/30` | Disabled buttons, placeholder text |
| Text color (error) | `text-error` | Error messages |
| Card border | `border border-base-300` | Archive item containers |
| Card hover | `hover:border-base-content/20` | Subtle card interactivity |
| Volume header | `text-base-content/40` | Section divider labels |
| Primary accent | `bg-primary` / `text-primary` / `border-primary` | Active states, "阅读" buttons, progress bar, "新" badge |
| Input border | `border-base-300` | Search bar |
| Input focus | `focus:border-primary focus:ring-primary/20` | Search bar focus ring |
| Prose text | `font-serif text-base leading-[2] text-base-content` | Chapter content |
| Skeleton | `skeleton bg-base-300` | Loading placeholders |
| Banner background | `bg-base-200/50` | Top toolbar area |

### Theme-specific considerations

| Element | novelforge (dark) | parchment (light) |
|---|---|---|
| Card shadow | `shadow-md shadow-black/20` | `shadow-sm shadow-black/5` |
| Prose contrast | `text-base-content` on `bg-base-100` (#14100b) = ~13:1 contrast | `text-base-content` on `bg-base-100` (#faf6ee) = ~10:1 |
| Hover state on cards | `hover:bg-base-300/30` | `hover:bg-base-200/60` |
| Separator lines | `border-base-300` (#2a2118) | `border-base-300` (#e0d5c0) |

Both themes exceed WCAG AA for all text sizes (minimum 7:1 for body text, verified against the hex values in `tailwind.config.js`).

---

## 6. NovelPage Integration

### 6.1 Tab Bar Changes

Add a third tab to the `NovelPage.tsx` tab bar (`line 33`):

```typescript
type TabId = "settings" | "writing" | "archives";

const TABS: { id: TabId; label: string }[] = [
  { id: "settings", label: "设定" },
  { id: "writing", label: "正文" },
  { id: "archives", label: "归档" },
];
```

### 6.2 ViewState Extension

```typescript
type ViewState =
  | { tab: "settings"; panel: string }
  | { tab: "writing"; panel: "empty" }
  | { tab: "writing"; panel: "volume"; volumeId: string }
  | { tab: "writing"; panel: "chapter"; chapterRef: string }
  | { tab: "writing"; panel: "versions"; chapterRef: string }
  | { tab: "archives"; panel: "browser" }                // ← NEW
  | { tab: "archives"; panel: "reader"; filename: string };  // ← NEW
```

### 6.3 Tab Switch Handler

When switching to the "archives" tab, hide the left sidebar:

```tsx
// In NovelPage.tsx render (around line 516)
const showSidebar = tab !== "archives";  // ← hide sidebar in archive view
```

The archive view takes the full content width:

```tsx
{/* Left tree panel — hidden in archives tab */}
{showSidebar && (
  <aside className="w-56 flex-shrink-0 overflow-y-auto border-r border-base-300 bg-base-200/30 p-2">
    <StructureTree ... />
  </aside>
)}
```

### 6.4 "Edit in Editor" Flow (Reader → Editor)

From the Archive Reader, clicking "编辑" performs:

1. Switch `tab` to `"writing"`
2. Set `viewState` to `{ tab: "writing", panel: "chapter", chapterRef }`
3. Navigate to `/project/:slug` (or just let the state update drive the UI)

This is 1 click (the button) from the reader to reach the editor. No intermediate screen.

### 6.5 Archive Badge on Tab

The archives tab shows the count of archived chapters as a badge:

```tsx
{tab === "archives" && project.total_archives > 0 && (
  <span className="badge badge-accent badge-xs ml-1">
    {project.total_archives}
  </span>
)}
```

This gives the user at-a-glance awareness of how many chapters are archived.

---

## 7. Component Tree and Props

### 7.1 `ArchivePage`

```
ArchivePage
├── Toolbar (back button + title + archive count)
├── ArchiveBrowser (when panel === "browser")
│   ├── SearchBar (input + filter toggle + sort select)
│   ├── VolumeGroup × N
│   │   ├── VolumeHeader (collapsible)
│   │   └── ArchiveCard × N
│   │       ├── Title + date + word count
│   │       ├── Summary (2-line truncated)
│   │       ├── "新" badge (conditional)
│   │       └── Action buttons (阅读, 编辑)
│   └── EmptyState (when no results match search)
└── ArchiveReader (when panel === "reader")
    ├── ReaderToolbar (back, breadcrumb, edit button)
    ├── ProgressBar (thin, top of content)
    ├── ReaderContent (renderMarkdown output, max-w-[70ch])
    └── ReaderFooter (prev/next, word count)
```

### 7.2 Props Interface

```typescript
// ── ArchivePage ─────────────────────────────────────────────

interface ArchivePageProps {
  projectId: string;
  projectName: string;
  onNavigateToEditor: (chapterRef: string) => void;
  onBack: () => void;
}

// ── ArchiveBrowser ──────────────────────────────────────────

interface ArchiveBrowserProps {
  projectId: string;
  items: ArchiveItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRead: (filename: string) => void;
  onEdit: (chapterRef: string) => void;
}

// ── ArchiveCard ─────────────────────────────────────────────

interface ArchiveCardProps {
  title: string;
  chapterRef: string;
  volume: number;
  chapter: number;
  wordCount: number;
  archiveDate: string;
  summary: string;
  isNew: boolean;
  onRead: () => void;
  onEdit: () => void;
}

// ── ArchiveReader ───────────────────────────────────────────

interface ArchiveReaderProps {
  projectId: string;
  filename: string;
  chapterRef: string;
  // Pre-loaded metadata from browser (for instant toolbar render)
  volume?: number;
  chapter?: number;
  title?: string;
  // Navigation
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onEdit: (chapterRef: string) => void;
}
```

### 7.3 Internal State (ArchiveReader)

```typescript
const [content, setContent] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [scrollProgress, setScrollProgress] = useState(0);
const contentRef = useRef<HTMLDivElement>(null);
```

### 7.4 Data Fetching

```typescript
// ArchivePage — load archives
async function loadArchives(): Promise<void> {
  setLoading(true);
  setError(null);
  try {
    const files: { filename: string; path: string }[] =
      await api.get(`/projects/${projectId}/archives`);

    // Parse chapter refs and fetch metadata in parallel
    const items = await Promise.all(
      files.map(async (f) => {
        const ref = parseChapterRef(f.filename); // "vol-1-ch-3" from filename
        try {
          const chapter = await api.get(
            `/projects/${projectId}/chapters/${ref}`
          );
          return buildArchiveItem(f.filename, chapter);
        } catch {
          return buildArchiveItem(f.filename, null); // metadata unavailable
        }
      })
    );
    setArchives(items);
  } catch (e: any) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
}

// ArchiveReader — load content
async function loadContent(): Promise<void> {
  setLoading(true);
  setError(null);
  try {
    const data: { filename: string; content: string } =
      await api.get(`/projects/${projectId}/archives/${filename}`);
    setContent(data.content);
  } catch (e: any) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
}
```

---

## 8. Interaction Flows

### 8.1 Primary Flow: Browse and Read

```
User clicks "归档" tab
  → NovelPage switches tab to "archives", hides sidebar
  → ArchivePage mounts, calls loadArchives()
  → Loading skeleton shown
  → Archives loaded and grouped by volume
  → User reads card summaries, finds a chapter
  → User clicks "阅读"
  → URL updates to /project/:slug/archives/vol-1-ch-3-*.md
  → ArchiveReader mounts, calls loadContent()
  → Content loading spinner
  → Full prose rendered at comfortable width
  → User reads, scrolls, sees progress bar update
  → User clicks "下一章" → next archive loads seamlessly
```

### 8.2 Secondary Flow: Archive → Editor

```
User is in Archive Reader
  → Clicks "编辑" button
  → NovelPage switches to writing tab
  → viewState becomes { tab: "writing", panel: "chapter", chapterRef: "vol-1-ch-3" }
  → ChapterEditor mounts with the chapter data loaded
  → User can now edit, archive again, or write more
  → (Total: 2 clicks from archive reader to editing)
```

### 8.3 Search and Filter Flow

```
User is in Archive Browser
  → Types in search bar (debounced 300ms)
  → Archive list filters in real-time, showing only matching items
  → User toggles "仅显示新归档"
  → Filter narrows to items with isNew === true
  → User clears search → full list restored
```

### 8.4 Error Recovery Flow

```
Archive Browser:
  → API call fails
  → Error state shown with "重试" button
  → User clicks retry → loadArchives() called again
  → Success → normal state. Failure → error persists.

Archive Reader:
  → API call fails
  → Error state shown with "重试" and "返回列表" buttons
  → User clicks retry → loadContent() called again
  → User clicks "返回列表" → back to browser
```

### 8.5 Edge: First-Time User

```
User just started writing, no chapters archived yet
  → Clicks "归档" tab
  → Empty state shown with guidance message
  → User clicks "回到正文" → back to writing tab
```

---

## 9. Accessibility

### 9.1 WCAG AA Compliance

| Requirement | Implementation |
|---|---|
| **Color contrast** | All text exceeds 4.5:1 ratio in both themes. See theme token section for verified values. |
| **Keyboard navigation** | Full keyboard nav: Tab through search bar, filter toggles, card actions. ArrowLeft/Right in reader for prev/next. Escape to return. |
| **Focus indicators** | Default daisyUI focus rings are preserved (`focus-visible:outline` on all interactive elements). Focus ring uses `ring-primary` for visibility in both themes. |
| **Screen reader** | All interactive elements have aria-labels. Archive cards use `role="article"`. Volume headers use `role="heading" aria-level="2"`. |
| **Reduced motion** | Progress bar transition and card hover effects use `motion-safe:transition` to respect `prefers-reduced-motion`. |

### 9.2 Semantic Structure

```html
<!-- Archive Browser -->
<nav aria-label="归档列表">     <!-- Top toolbar -->
<main role="list">              <!-- Volume groups -->
  <section aria-label="第一卷">  <!-- Volume group -->
    <h2>── 第一卷 (8章) ──</h2>
    <article>                   <!-- Archive card -->
      <h3>第3章: 初遇</h3>
      <p>摘要内容...</p>
      <button>阅读</button>
      <button>编辑</button>
    </article>
  </section>
</main>

<!-- Archive Reader -->
<nav aria-label="阅读工具栏">    <!-- Toolbar -->
<main role="main" aria-label="正文">
  <!-- rendered prose -->
</main>
<nav aria-label="章节导航">      <!-- Prev/Next footer -->
```

### 9.3 Touch Targets

All interactive elements meet minimum 44x44px touch target:

| Element | Size |
|---|---|
| Card action buttons | `btn-xs` (32px height) + padding = 44px+ touch area via `min-h-[44px]` |
| Search bar | 38px height, meets at desktop |
| Prev/next buttons | `btn-sm` (38px) + padding |
| Back button | `btn-ghoot btn-sm` (38px) |

---

## 10. Implementation Notes

### 10.1 File Structure

```
client/frontend/src/pages/ArchivePage.tsx           # Page container (browser ↔ reader)
client/frontend/src/components/novel/ArchiveCard.tsx # Single archive card
client/frontend/src/components/novel/ArchiveReader.tsx # Reader view (content + nav)
```

Optionally, merge `ArchiveCard` inlines into `ArchivePage.tsx` to keep component count minimal (prefer fewer files). The reader should be its own file since it has substantial logic.

### 10.2 API Enhancement Recommendation

The current `GET /api/projects/{id}/archives` returns only `{filename, path}` pairs. For the optimal UX described in this spec, a single enriched endpoint would eliminate the N+1 metadata fetch:

```json
// Proposed: GET /api/projects/{id}/archives/metadata
[
  {
    "filename": "vol-1-ch-3-the-beginning.md",
    "chapterRef": "vol-1-ch-3",
    "title": "初遇",
    "volume": 1,
    "chapter": 3,
    "wordCount": 2840,
    "archiveDate": "2026-07-20T10:30:00",
    "summary": "阿黄在村口遇见了...",
    "isNew": true
  }
]
```

Alternatively, the existing `GET /api/projects/{id}/chapters/{chapterRef}` already returns the chapter YAML which includes `archive_summary`. The frontend can work with that in the current implementation, accepting the N+1 for metadata enrichment.

### 10.3 Parsing ChapterRef from Filename

```typescript
function parseChapterRef(filename: string): string | null {
  const match = filename.match(/^(vol-\d+-ch-\d+)/);
  return match?.[1] ?? null;
}
```

### 10.4 Building ArchiveItem from Chapter Data

```typescript
function buildArchiveItem(
  filename: string,
  chapter: any | null
): ArchiveItem {
  const ref = parseChapterRef(filename) ?? filename;
  const vol = parseInt(filename.match(/vol-(\d+)/)?.[1] ?? "0", 10);
  const ch = parseInt(filename.match(/ch-(\d+)/)?.[1] ?? "0", 10);

  return {
    filename,
    chapterRef: ref,
    volume: vol,
    chapter: ch,
    title: chapter?.title ?? `第${ch}章`,
    wordCount: chapter?.prose ? chapter.prose.replace(/\s/g, "").length : 0,
    archiveDate: chapter?.archive_date ?? "—",
    summary: chapter?.archive_summary ?? "暂无摘要",
    isNew: isRecentlyArchived(chapter?.archive_date),
  };
}
```

### 10.5 Reuse of `renderMarkdown`

The `renderMarkdown()` function in `ChapterEditor.tsx` (line 54) is a standalone pure function that takes text and returns an HTML string. The Archive Reader imports and calls it identically:

```typescript
import { renderMarkdown } from "../ChapterEditor";
```

Or, since it's a utility function, extract it to `lib/markdown.ts` and import in both ChapterEditor and ArchiveReader.

### 10.6 Word Count Helper

Already exists inline in `ChapterEditor.tsx` (line 49):

```typescript
function countChars(text: string): number {
  if (!text) return 0;
  return text.replace(/\s/g, "").length;
}
```

Extract to `lib/wordcount.ts` for shared use, or keep the inline -- only two consumers (ChapterEditor and ArchiveCard).

### 10.7 Archive Navigation Order

When calculating "previous" and "next" archives, sort by `(volume * 1000 + chapter)` ascending:

```typescript
function sortArchives(items: ArchiveItem[]): ArchiveItem[] {
  return [...items].sort(
    (a, b) => a.volume * 1000 + a.chapter - (b.volume * 1000 + b.chapter)
  );
}
```

The current reader's current index is found via `findIndex()`, then `index - 1` and `index + 1` give prev/next.

### 10.8 Scroll Restoration

When navigating between archives in the reader, the scroll position resets to the top. When returning to the browser from the reader, the scroll position is preserved via a ref that stores the scroll position before navigation.

### 10.9 Dependencies (new)

None outside the existing project dependencies:
- `lucide-react` (already installed)
- `react-router-dom` (already installed)
- `daisyui` (already installed)

### 10.10 Implementation Order

| Step | Files | Effort |
|---|---|---|
| 1. Extract `renderMarkdown` and `countChars` to shared lib | `lib/markdown.ts`, `lib/wordcount.ts` | 0.5h |
| 2. Create `ArchivePage.tsx` (browser layout + state management) | `pages/ArchivePage.tsx` | 4h |
| 3. Create `ArchiveCard.tsx` (card component + all states) | `components/novel/ArchiveCard.tsx` | 2h |
| 4. Update `NovelPage.tsx` (tab integration, route handling) | `pages/NovelPage.tsx` | 2h |
| 5. Update `App.tsx` (route wiring) | `App.tsx` | 0.5h |
| 6. Create `ArchiveReader.tsx` (reader view, nav, progress) | `components/novel/ArchiveReader.tsx` | 4h |
| 7. Polish: animations, transitions, edge cases | Various | 2h |
| **Total** | | **~15h (2 days)** |

---

## Appendix A: Comparison with Existing Patterns

| Pattern | Existing (source) | Archive implementation |
|---|---|---|
| Error + retry | `ChapterEditor.tsx` line 416-424 | Same layout: error text + retry button |
| Loading skeleton | `NovelPage.tsx` line 431-459 | Card skeletons instead of sidebar skeletons |
| Empty state | `EmptyState.tsx` | Reuses same layout shape, different copy |
| Back navigation | `VersionHistory.tsx` line 59-64 | Same `← 返回...` button pattern |
| Data fetching | `VersionHistory.tsx` line 27-33 | Same `useEffect` + `api.get` pattern |
| Markdown rendering | `ChapterEditor.tsx` line 54-86 | Same `renderMarkdown()` function |
| View state machine | `NovelPage.tsx` line 22-27 | Extended with `archives` tab variants |

## Appendix B: Scroll Progress Calculation

```typescript
function handleScroll() {
  const el = contentRef.current;
  if (!el) return;
  const maxScroll = el.scrollHeight - el.clientHeight;
  if (maxScroll <= 0) {
    setScrollProgress(100);
    return;
  }
  const progress = (el.scrollTop / maxScroll) * 100;
  setScrollProgress(Math.min(100, Math.max(0, progress)));
}
```

Attached via `onScroll` on the content container div.

---

*End of design spec. Ready for developer handoff.*
