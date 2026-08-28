## MODIFIED Requirements

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
