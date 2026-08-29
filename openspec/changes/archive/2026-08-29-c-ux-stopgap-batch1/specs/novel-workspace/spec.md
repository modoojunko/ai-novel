## MODIFIED Requirements

### Requirement: Route convergence to single index

- The system SHALL collapse `/novel/:id` to a single index route rendering `NovelWorkspace`.
- The dead child routes `settings`, `settings/world`, `settings/style`, `settings/anti-ai`, `settings/hooks`, `outline`, `prompts`, `write`, `archives`, `threads` SHALL be removed from `App.tsx` (no more `Navigate to=".."` dead links).
- The redirect routes `/books → /novels` and `/project/:id → /novel/:id` SHALL remain unchanged.
- Unknown routes (`path="*"`) SHALL redirect to `/novels` with `replace`, so stale or mistyped deep links never render a blank page.

#### Scenario: Deep link reaches the workspace
- Given a URL `/novel/:id`
- When it is loaded
- Then `NovelWorkspace` renders as the index child of `NovelLayout`

#### Scenario: Old subroutes no longer resolve as dead links
- Given a URL such as `/novel/:id/settings`
- When it is loaded
- Then it does not render a `Navigate` dead-link component; it resolves to the workspace (or a 404) without a stale child redirect

#### Scenario: Unknown route lands on the bookshelf
- Given a URL that matches no route
- When it is loaded
- Then the app redirects to `/novels` and renders the bookshelf instead of a blank page
