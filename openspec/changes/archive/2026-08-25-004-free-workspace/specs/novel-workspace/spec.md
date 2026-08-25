# Novel Workspace（四态视图机 + PRO 容器）

## ADDED Requirements

### Requirement: Four-state workspace view machine

- The system SHALL provide `components/novel/NovelWorkspace.tsx` as the single workspace replacing `pages/NovelPage.tsx`.
- The workspace SHALL expose exactly four views: `workbench | advanced-settings | advanced-outline | archives`.
- The default landing view SHALL be `workbench` (writing is always the primary surface, C5 / P0-5).
- The `workbench` view SHALL remain mounted at all times; switching to another view SHALL hide it via a `hidden` class (display:none) rather than unmounting, so un-saved prose input and cursor position within the 1.5s autosave debounce window are preserved.
- The `advanced-settings`, `advanced-outline`, and `archives` views SHALL lazy-mount on first visit and unmount when leaving (FE P1-1); they SHALL NOT stay mounted hidden after leaving.
- The workspace SHALL provide `setView(view, payload)` that accepts an optional navigation payload (e.g. which chapter to focus) for descendants.
- `DeleteConfirmModal` SHALL remain at the NovelWorkspace layer (available from any view).

#### Scenario: Default landing is workbench
- Given a mounted NovelWorkspace for an existing project
- When the workspace initializes
- Then the active view is `workbench` and the writing workbench is visible

#### Scenario: Workbench stays mounted while switching views
- Given the workbench has unsaved prose input within the debounce window
- When the user switches to advanced-settings and back to workbench
- Then the prose input value and cursor are preserved (the workbench was hidden, not unmounted)

#### Scenario: Advanced views lazy-mount and unmount on leave
- Given a workspace where advanced-settings was never visited
- When the user first switches to advanced-settings
- Then the view mounts; after switching back to workbench, the advanced-settings tree unmounts

### Requirement: PRO container (N14)

- The system SHALL provide `components/novel/ProContainer.tsx` that renders its children only when the user is on a paid tier.
- `ProContainer` SHALL use `useTier().isFree` to decide; when free, it SHALL render `null` and NOT render the subtree.
- The phase-gating UI — `TabProgressButton` phase tabs, `GateBanner`, `OnboardingCard`, and the `useNovelState` phase-status hook — SHALL be placed inside a ProContainer subtree so that free users render none of them and issue no phase-status request.
- Hooks inside the ProContainer subtree SHALL NOT be called at the top level of NovelWorkspace (no conditional hook calls); they live inside a child component that only mounts for paid users.

#### Scenario: Free tier renders no phase UI
- Given a free-tier user viewing the workspace
- When the workspace renders
- Then no TabProgressButton phase tabs, GateBanner, or OnboardingCard are present in the DOM and no `GET .../workflow/phase-status` request is issued

#### Scenario: Paid tier renders phase UI
- Given a paid-tier user viewing the workspace
- When the workspace renders
- Then the phase tab bar and gate banner subtree are present

### Requirement: Route convergence to single index

- The system SHALL collapse `/novel/:id` to a single index route rendering `NovelWorkspace`.
- The dead child routes `settings`, `settings/world`, `settings/style`, `settings/anti-ai`, `settings/hooks`, `outline`, `prompts`, `write`, `archives`, `threads` SHALL be removed from `App.tsx` (no more `Navigate to=".."` dead links).
- The redirect routes `/books → /novels` and `/project/:id → /novel/:id` SHALL remain unchanged.

#### Scenario: Deep link reaches the workspace
- Given a URL `/novel/:id`
- When it is loaded
- Then `NovelWorkspace` renders as the index child of `NovelLayout`

#### Scenario: Old subroutes no longer resolve as dead links
- Given a URL such as `/novel/:id/settings`
- When it is loaded
- Then it does not render a `Navigate` dead-link component; it resolves to the workspace (or a 404) without a stale child redirect
