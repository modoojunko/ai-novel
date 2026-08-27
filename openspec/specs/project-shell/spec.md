# project-shell Specification

## Purpose
TBD - created by archiving change 003-two-tier-foundation. Update Purpose after archive.

## Requirements

### Requirement: NovelLayout mounts tier context and project shell

- `pages/NovelLayout.tsx` SHALL render `AuthGuard → LicenseProvider → ProjectShell → Outlet` so that every descendant of a `/novel/:id` route has access to both the license tier and the project context.
- AuthGuard SHALL remain the outermost gate (redirects to `/login` when unauthenticated).

#### Scenario: Novel route descendants have context
- Given a logged-in user navigating to `/novel/:id`
- When the NovelLayout renders
- Then descendants can read the license tier and the project from context

### Requirement: useProject hook

- The system SHALL provide a `useProject()` hook backed by a `ProjectShell` context.
- The `ProjectShell` SHALL call `GET /novels/{id}` once on route id change and expose `{ project, loading, error }` via context.
- While fetching, `loading` SHALL be true (consumers — e.g. NovelPage — render the existing skeleton).
- On failure, `project` SHALL be null and `error` set (no crash).
- The hook SHALL return safe defaults `{ project: null, loading: false, error: null }` when called outside the `ProjectShell` provider.

#### Scenario: Descendant reads project
- Given a mounted ProjectShell for a valid novel id
- When a descendant calls `useProject()`
- Then it receives the fetched `project` object

#### Scenario: Loading flag while fetching
- Given a ProjectShell that has not yet resolved the project
- When a descendant reads `useProject()`
- Then `loading` is true

#### Scenario: Fetch failure degrades gracefully
- Given `GET /novels/{id}` rejects
- When the shell finishes loading
- Then `project` is null, `error` is set, and no exception escapes
