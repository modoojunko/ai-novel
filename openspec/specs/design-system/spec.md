# design-system Specification

## Purpose

Single source of truth for product-wide visual vocabulary across both frontends (C-end React SPA in `client/frontend`, S-end Vue console in `server/frontend`), so every UI-touching change reuses the same tokens, status language, component roles and destructive-action rules instead of inventing local variants. Authoritative detail lives in `docs/ux/design-language.html` (state language, terminology) and `docs/ux/cross-end.html` (three-layer contract, drift rulings, migration map); this spec holds the enforceable requirements.

## Requirements

### Requirement: One shared token palette and theme
- Both frontends SHALL use one light theme built on identical oklch tokens (`--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, `--accent-strong`, `--accent-soft`, `--ok`/`--ok-soft`, `--warn`/`--warn-soft`, `--err`/`--err-soft`, `--fg-soft`) declared in each end's `src/design/base.css`; token drift between ends is a defect.
- Text on accent or dark surfaces SHALL use an explicit foreground token, never a borrowed surface or background token.
- Derived soft variants SHALL be produced with `color-mix(in oklch, …, transparent)`; raw hex/rgb literals are forbidden in either end's source.
- Status colors follow N6: red (`--err`) means irreversible-or-immediate actions only; cautionary-but-safe content uses `--warn` or accent.

#### Scenario: Same warning surface in either console
- Given a screen needs a persistent cautionary notice
- When it is styled
- Then it uses the warn soft background through the notice family and not red

### Requirement: Shared status language and tone words
- Progress-bearing objects SHALL express state through the three-state dot classes (`dot-empty`, `dot-warn`, `dot-ok`) plus a title attribute wherever progress semantics exist.
- Badges SHALL use the `.pill` family (roles tag/status/count x tones); callout bars SHALL use the `.notice` family with explicit modifiers; toast severity may add `warn`.
- The cross-end tone vocabulary is fixed at info / ok / warn / err. Retired synonyms (success/danger as notice or badge tones, the `.b` badge names, `.strip`) MUST NOT reappear. The save-state ladder remains autosaving, unsaved, failed-with-retry, saved.
- Streaming/AI activity SHALL be expressed by a breathing accent dot; prose layout MUST NOT animate during streaming.

#### Scenario: Same object viewed twice
- Given a chapter confirmed in the workbench tree
- When the preview view lists that chapter
- Then it shows the same dot-ok semantics derived from the same data

#### Scenario: S端 console uses unified badge and notice vocabulary
- Given any S端 console, auth or landing screen needs a badge or a callout bar
- When the page renders
- Then badges use `.pill` role × tone classes and callout bars use `.notice` with an explicit tone, and no `.b` or `.strip` class remains in S端 source or rendered DOM

### Requirement: Prototype-first flow with per-end gates
- Any user-visible C-end change SHALL update `docs/design-c/prototypes/<screen>.html` and record deviations in `docs/design-c/prototypes/ADJUSTMENTS.md` before implementation, and SHALL pass `npm run design:check` under 0.2% pixel difference per baseline scenario.
- S-end changes have no prototype baseline; they SHALL provide before/after screenshot pairs inside the change folder as consistency evidence.
- Vocabulary edits SHALL land in both ends' `scripts/design-vocab.mjs` in the same batch, derived from the standard doc (`docs/ux/design-language.html`), so the doc and the whitelists never diverge.

#### Scenario: Deviating spacing needs registration
- Given an implementation keeps a denser rhythm than the default spacing scale
- When reviewed
- Then ADJUSTMENTS.md documents the deviation and its reason, or the change is rejected

### Requirement: Component vocabulary reuse before invention
- Buttons SHALL map to the existing `.btn` size/variant ladder; C-end wrappers around it MUST NOT be introduced, and S-end shell components SHALL compile down to those same classes.
- Static capsules belong to pill roles (tag/status/count); clickable capsule-like controls belong to the chip family.
- Destructive confirmations SHALL render through an in-app modal confirm (no native `window.confirm`), listing affected items as inventory when deletion cascades.
- Empty states SHALL offer at least one actionable exit alongside the descriptive line.

#### Scenario: Delete affecting linked content
- Given deleting a config that books depend on
- When the user confirms
- Then an in-app dialog lists the affected items as inventory chips before deletion executes

### Requirement: Cross-end shared-class synchronization
- Classes that must render identically — tokens block (including `--on-accent`), `.btn` ladder, modal family, form base and error states, toast (including the `warn` tone), notices (`.notice` with explicit `info/ok/warn/err` tones), pills (`.pill` role × tone family), skeleton atoms (`.sk` + `sk-pulse`), panel cards (`.panel` + `hoverable/hl/compact`), empty-state slots — SHALL exist under the same name with the same declarations in both ends' `src/design/base.css`, inside a `@cross-begin/@cross-end` marked segment.
- The `@cross-begin/@cross-end` markers and the validation script `scripts/design-cross.mjs` (repo root) SHALL exist; both ends' `package.json` SHALL expose it as `design:cross`.
- When legal values diverge between ends, the parity-gated C-end value wins unless the change registers a reasoned deviation.
- The validation script SHALL fail on single-side drift of the shared segment, and icon registries' common keys SHALL have identical path data.

#### Scenario: One snippet, two apps
- Given an HTML fragment using shared classes
- When pasted into a C-end screen and an S-end screen
- Then the rendered results match apart from font fallbacks

#### Scenario: Single-side drift fails validation
- Given one end edits a shared-class declaration alone
- When the cross check runs
- Then it exits non-zero naming the divergent selector

#### Scenario: Shared segment baseline is zero-diff
- Given the change that establishes the markers has landed
- When `design:cross` runs on both ends
- Then the marked segments are byte-identical after whitespace normalization

### Requirement: Free vs PRO gating stays visible
- PRO-only capabilities SHALL keep their entry points visible to free users in locked form with one sentence describing what unlocking provides; hiding entries is the documented exception requiring compensating notice.
- Gating vocabulary in UI text SHALL avoid internal terms (gate/readiness/license errors); it describes what is missing and how to proceed.

#### Scenario: Free hits project limit
- Given a free account already has the maximum number of projects
- When they view the shelf
- Then create/import appear locked with an upgrade path rather than being hidden
