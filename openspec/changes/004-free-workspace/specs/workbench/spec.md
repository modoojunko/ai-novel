# Workbench（两栏工作台 + 树 + 栏/面包屑/状态栏）

## ADDED Requirements

### Requirement: useWorkbench hook

- The system SHALL provide `hooks/useWorkbench.ts` assembling: project metadata (from `useProject`), the volume/chapter tree, current selection (`selectedId` / `selectedRef`), the four-state view + `setView(view, payload)`, `expandedIds` / `onToggle`, `onSelectNode`, tree CRUD (`createVolume` / `createChapter` / `renameNode` / `deleteNode`), `refresh`, and `focusNode(ref)`.
- The tree SHALL be sourced from the backend; while the DB-backed `/volumes` full-tree contract (change 005) is not yet available, the hook SHALL degrade to the current legacy shape: `GET /volumes` (list) then per-volume `GET /volumes/{filename}` to assemble `chapters`.
- The tree and selection state SHALL be shared across views (workbench and advanced-outline consume the same `volumes` array), so switching views does not split state (C3/R3).
- `VolumeEntry` (exported by `hooks/useOutline.ts`) SHALL gain optional `has_prose?: boolean` and `archived?: boolean` fields, defaulting via `??` fallback for backward compatibility (N1).
- `focusNode(ref)` SHALL locate the tree node with the given chapter ref and select it.

#### Scenario: Tree loads from legacy volumes shape
- Given a project with volumes and chapters on the current backend
- When `useWorkbench` initializes
- Then it assembles a tree with volume and chapter nodes including per-chapter `word_count`/`status`, and `has_prose` falls back to a local heuristic when the field is absent

#### Scenario: Selection persists across view switches
- Given a chapter selected in the workbench tree
- When the user switches to advanced-outline and back
- Then the same chapter remains selected

### Requirement: WritingTree with persistent create actions (N1/N2)

- The system SHALL provide `components/novel/WritingTree.tsx` wrapping `StructureTree`.
- The tree SHALL render persistent 「+ 新建卷」 and 「+ 新建章」 action buttons at its top (N1).
- Clicking 「+ 新建章」 SHALL create a volume first if none exists, create the next chapter (`第N章`), refresh the tree, and immediately focus the new chapter in the editor (N1 "建章即达编辑器").
- Empty chapters (`!has_prose && !isSelected && not newly created this session`) SHALL be displayed with a de-emphasized 「未写」 marker; they SHALL NOT be hard-filtered out (N1). When `has_prose` is absent, the current/selected volume/chapter SHALL always display.
- Hovering a volume or chapter SHALL reveal config / rename / delete affordances (N2); rename and delete SHALL call the corresponding CRUD endpoints and refresh the tree.
- Chapter nodes SHALL show a word-count badge when prose exists and an archive 📦 badge when archived.
- `StructureTree` SHALL gain a minimal `onAddChild?` row-insert slot rendered on volume hover, without changing its core structure.

#### Scenario: New chapter reaches editor immediately
- Given an empty project (no volumes)
- When the user clicks 「+ 新建章」
- Then a volume is auto-created, `第1章` is created under it, and the editor for that chapter opens and is ready to type

#### Scenario: Empty chapters are softened, not filtered
- Given a chapter with no prose that is not selected
- When the tree renders
- Then the chapter appears with a 「未写」 de-emphasized marker instead of being hidden

### Requirement: NovelBar with advanced-config entry (N3)

- The system SHALL provide `components/novel/NovelBar.tsx` with: inline book-title rename (blur/Enter saves, Esc cancels, `savedRef` prevents double-save), a type label, an archive action, a 「高级配置 ▾」 entry (settings/outline) that is **visible and enterable on free tier** with an 「可选」 marker (N3), and a free/PRO hint.
- The 「高级配置」 entry SHALL call `setView('advanced-settings')` / `setView('advanced-outline')`.
- On free tier (`tier === 'none'`), the bar SHALL show 「免费 · 完整人工写作（限 1 部作品）」.
- The type label SHALL render `project.type || project.genre` with empty-fallback when the backend fields are absent.

#### Scenario: Advanced-config visible on free tier
- Given a free-tier user on the workbench
- When NovelBar renders
- Then a visible 「高级配置 ▾」 entry with an 「可选」 marker is present and navigates to the settings/outline views

#### Scenario: Inline rename without double-save
- Given the user editing the book title
- When they press Enter then blur
- Then the title saves exactly once

### Requirement: Breadcrumb navigation (N17)

- The system SHALL provide `components/novel/Breadcrumb.tsx` rendering `作品名 / 第N卷 / 第N章` with `h-9` lightweight styling, shown only in the writing workbench.
- Volume and chapter segments SHALL be clickable buttons that select the corresponding node (`onSelectNode` / `focusNode`); the current node SHALL be highlighted.
- Breadcrumb SHALL remain visible in focus mode.

#### Scenario: Breadcrumb navigates to volume
- Given the breadcrumb showing a volume segment
- When the user clicks the volume segment
- Then that volume is selected in the tree

### Requirement: Workbench two-column layout with focus mode

- The system SHALL provide `components/novel/Workbench.tsx` with a left `WritingTree` column, a right editor region, and `BottomStatusBar`, and SHALL own the `focusMode` state.
- Focus mode SHALL hide the left tree and editor toolbar, retain the breadcrumb and bottom status bar, center the prose area (`max-w-3xl mx-auto`), and exit on `Esc` (global listener).
- When no chapter is selected, the editor region SHALL render the refactored `EmptyState`.

#### Scenario: Focus mode leaves only writing essentials
- Given focus mode is active
- When the user looks at the workbench
- Then only the breadcrumb, centered prose area, and bottom status bar are visible

### Requirement: BottomStatusBar with save states and progress (N5/N13)

- The system SHALL provide `components/novel/BottomStatusBar.tsx` showing: live word count, the save four-state (autosaving / saved / unsaved / failed-with-retry), and an embedded progress bar (`progress progress-primary h-1.5`) of `wordCount / targetWords` in the same row.
- The target word count SHALL be editable in place (click target → input → change writes back via `useChapterData.setTargetWords`), updating the bar immediately (N5).
- The archived state SHALL freeze the progress display.

#### Scenario: Target words adjust progress immediately
- Given a chapter with 500 words and target 1000
- When the user edits the target to 2000
- Then the progress bar recomputes to 25% immediately

### Requirement: EmptyState without settings gating (N4)

- The system SHALL refactor `components/novel/EmptyState.tsx` to remove the `settingsComplete`/`bypass` gate branches.
- The empty state SHALL present 「添加卷」 / 「添加章」 primary actions, an advanced-config secondary link (marked 「可选」), and a 「先写正文」 hint.
- The empty state SHALL NOT block or prompt "先去设定".

#### Scenario: New book reaches writing without settings
- Given a newly created book with no volumes or chapters
- When the workbench empty state renders
- Then it offers add-volume / add-chapter actions directly, with no settings-completeness gate and no "先去设定" blocker
