# chapter-data Specification

## Purpose
TBD - created by archiving change 004-free-workspace. Update Purpose after archive.

## Requirements

### Requirement: useChapterData hook

- The system SHALL provide `hooks/useChapterData.ts` exposing `{ chapter, prose, summary, status, isDirty, saveState, wordCount, targetWords, setTargetWords, save, retry, archive, unarchive, loading, error }`.
- On load, the hook SHALL fetch the chapter (`GET /novels/{projectId}/chapters/{ref}`) and populate prose / outline summary / status.
- Auto-save SHALL debounce at **1500ms** after the last content change (N8: reduced from the legacy 3000ms).
- The save state SHALL be one of exactly four: `autosaving | saved | unsaved | failed`; the failed state SHALL expose a `retry()` action.
- `wordCount` SHALL count non-whitespace Chinese characters, consistent with the backend `/tree` metric (B5).
- `targetWords` SHALL persist (localStorage or chapter metadata) and be adjustable via `setTargetWords`.
- `isDirty` SHALL be `prose !== initialProse || summary !== initialSummary || status !== initialStatus`.
- The hook SHALL flush unsaved changes on unmount or chapter switch (no lost-window).
- The save endpoint SHALL prefer `PUT .../chapters/{ref}/prose` with body `{prose}` (backend #12); while that endpoint is absent it SHALL degrade to `PUT /chapters/{ref}` with the full merged body.

#### Scenario: Debounced autosave after idle
- Given a chapter with prose loaded and a change typed
- When the user stops typing for 1.5 seconds
- Then the chapter auto-saves and the save state transitions to `saved`

#### Scenario: Save failure shows retry
- Given the save request rejects
- When the save finishes
- Then the save state is `failed` and a retry action is available

#### Scenario: Word count counts Chinese chars without whitespace
- Given prose `"你好 世界\n\n。"`
- When `wordCount` is computed
- Then it equals 5

#### Scenario: Flush on unmount
- Given a chapter with unsaved edits
- When the editor unmounts or the chapter changes
- Then the pending edits are flushed to the server

### Requirement: Free-tier chapter editor

- The system SHALL refactor `components/novel/ChapterEditor.tsx` so that the AI surface is hidden on free tier while the code remains (N14/P0-6): the prompt tab, 「AI 写本章」, 「质量检查」, and RightToolbar wiring SHALL be wrapped in `<TierGate feature="ai-generate">`.
- The prose body SHALL remain a `textarea` in this phase (ProseEditor is a later change).
- `onAIStateChange` SHALL NOT be wired in the free tier (the parent RightToolbar render chain is removed).
- Save logic SHALL move to `useChapterData`; the `ChapterEditorHandle` SHALL be retained with AI methods degraded/no-op on free tier.
- The manual save + 1.5s autosave SHALL both be available on free tier; a save failure SHALL show a 「重试」 action.

#### Scenario: Free tier hides AI controls
- Given a free-tier user editing a chapter
- When the editor renders
- Then no 「AI 写本章」, prompt tab, or 「质量检查」 control is present, but the textarea, manual save, and autosave work

#### Scenario: Pro tier restores AI path
- Given a paid user editing a chapter
- When the editor renders
- Then the AI write/quality-check/prompt controls are present as before

#### Scenario: Archived chapter is read-only
- Given an archived chapter being edited
- When the editor renders
- Then the prose area is read-only and an archive indicator is shown
