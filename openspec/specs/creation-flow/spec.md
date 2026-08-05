# creation-flow Specification

## Purpose
TBD - created by archiving change creation-simplify. Update Purpose after archive.
## Requirements
### Requirement: Name-only creation
- The create modal SHALL collect only a book name (single-stage).
- The modal SHALL have no import entry, no AI naming, and no synopsis/genre collection.
- An empty name SHALL disable the create button.
- Submitting (in-flight) SHALL lock all close paths (backdrop, X, Esc).
- The create endpoint SHALL NOT require AI access, so free-tier users can create novels.

#### Scenario: Name-only create
- Given an author opens the create modal
- When they enter a book name and click create
- Then a novel is created with that name and they enter the novel page
- And no synopsis, genre or AI steps were involved

#### Scenario: Empty name blocks
- Given the create modal is open
- When the name input is empty
- Then the create button is disabled

### Requirement: Rename (display name only)
- The backend PATCH /api/novels/{id} endpoint SHALL rename the display name only.
- slug and root_path SHALL remain unchanged.
- An empty name SHALL return 422.
- Saving the same name SHALL be idempotent (200).
- A missing novel SHALL return 404.
- Two frontend entries SHALL exist: the list-card dropdown menu and the detail-page title inline edit.
- The inline-edit pencil SHALL be always visible (not hover-only).

#### Scenario: Rename keeps slug
- Given an existing novel with slug "abc"
- When the author renames it via PATCH
- Then the name changes and the slug stays "abc"

#### Scenario: Rename from two entries
- Given a novel on the list page
- When the author uses the card dropdown "重命名" or the title inline edit
- Then the rename modal/input appears and saving updates the name in place

### Requirement: Settings backfill (manual synopsis)
- GET /api/novels/{id}/story SHALL read story.yaml.synopsis.
- PUT /api/novels/{id}/story SHALL write story.yaml.synopsis and SHALL NOT trigger AI prefill.
- A synopsis card SHALL be globally visible across all settings sub-items.
- The AI one-click generation entry SHALL be hidden in settings this iteration.

#### Scenario: Write and read back synopsis
- Given a novel with empty synopsis
- When the author saves a synopsis via the card
- Then GET /story returns the same text and the card shows "已补录"

#### Scenario: Free-tier create/rename not blocked
- Given a free-tier user without AI access
- When they create a novel or rename one
- Then the request succeeds (no 403 from require_ai_access)

