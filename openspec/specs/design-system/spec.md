# design-system Specification

## Purpose

Single source of truth for C-end visual vocabulary so that every UI-touching change reuses the same tokens, status language, component roles and destructive-action rules instead of inventing local variants. Authoritative detail (tables, code values, Chinese terminology) lives in `docs/ux/design-language.html`; this spec holds the enforceable requirements.

## Requirements

### Requirement: Single visual theme and oklch token palette
- The C-end SHALL use one light theme built on oklch tokens (`--bg/--surface/--fg/--muted/--border/--accent/--ok/--warn/--err`) defined in `src/design/base.css`.
- Derived soft variants SHALL be produced with `color-mix(in oklch, …, transparent)`; raw hex/rgb literals are forbidden.
- Status colors follow N6: red (`--err`) SHALL mean irreversible-or-immediate actions only; cautionary-but-safe content SHALL use `--warn` or accent.

#### Scenario: New warning surface reuses warn tone
- Given a screen needs a persistent cautionary notice
- When it is styled
- Then it uses `--warn` soft background via the notice family and not red

### Requirement: Shared status language for objects
- Chapters/volumes/settings objects SHALL express progress through the shared three-state dot classes (`dot-empty`, `dot-warn`, `dot-ok`) with an explanatory title attribute.
- Aggregated progress surfaces SHALL use pill badges of the `.pill` family (role × tone) rather than bespoke badge styles.
- Save state SHALL aggregate to exactly four phases: autosaving, unsaved, failed-with-retry, saved.
- Streaming/AI activity SHALL be expressed by a breathing accent dot; prose layout MUST NOT animate during streaming.

#### Scenario: Same object, two views
- Given a chapter confirmed in the workbench tree
- When the preview view lists that chapter
- Then it shows the same `dot-ok` semantics derived from the same data

### Requirement: Prototype-first change flow with parity gate
- Any user-visible change SHALL update `docs/design-c/prototypes/<screen>.html` first and record deviations in `docs/design-c/ADJUSTMENTS.md` before implementation.
- Implementation merges SHALL pass `npm run design:lint` and `npm run design:check` (pixel difference below 0.2% per baseline scenario).
- Vocabulary edits SHALL be applied to both `docs/design-c/DESIGN.md` and `scripts/design-vocab.mjs`.

#### Scenario: Deviating padding needs registration
- Given implementation keeps a denser rhythm than the default spacing scale
- When reviewed
- Then ADJUSTMENTS.md documents the deviation and its reason, or the change is rejected

### Requirement: Component vocabulary reuse before invention
- Buttons SHALL map to the existing `.btn` size/variant ladder; wrappers around them MUST NOT be introduced.
- Static capsules SHALL use the `.pill` family roles (status/tag/count, PRO as exception); clickable capsule-like controls belong to the `.chip` family.
- Destructive confirmations SHALL render through the in-app confirm modal (modal-based, no X close button, inventory chips when deletion affects other content); native `window.confirm` MUST NOT be added.
- Empty states SHALL offer at least one actionable exit alongside the descriptive line.

#### Scenario: Delete affecting linked content
- Given deleting a config that books depend on
- When the user confirms
- Then an in-app dialog lists the affected items as inventory chips before deletion executes

### Requirement: Free vs PRO gating stays visible
- PRO-only capabilities SHALL keep their entry points visible to free users in locked form with one sentence describing what unlocking provides; hiding entries is the documented exception requiring compensating notice.
- Gating vocabulary in UI text SHALL avoid internal terms (gate/readiness/license errors); it describes what is missing and how to proceed.

#### Scenario: Free hits project limit
- Given a free account already has the maximum number of projects
- When they view the shelf
- Then create/import appear locked with an upgrade path rather than being hidden
