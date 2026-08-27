# pro-hide-advanced-dropdown — Specification

## ADDED Requirements

### Requirement: PRO 态隐藏顶栏「高级配置」下拉

- The system SHALL render the NovelBar「高级配置 ▾」dropdown only when the current tier is free (`isFree === true`).
- In PRO state, the four phase views (设定/大纲/正文/归档) SHALL be reachable exclusively via the phase tabs in `ProPhaseSurface`.
- In free state, the dropdown SHALL remain the sole entry to 设定/大纲/归档 (no phase tabs render).

#### Scenario: PRO hides the advanced dropdown
- Given a PRO (non-free) session viewing a novel
- Then the top-bar「高级配置」dropdown is not rendered
- And the phase tabs provide 设定/大纲/正文/归档 entries

#### Scenario: Free keeps the advanced dropdown
- Given a free session viewing a novel
- Then the top-bar「高级配置 ▾」dropdown is rendered with 设定/大纲/归档 menu items

### Requirement: PRO 态隐藏 EmptyState 引导区高级配置按钮

- The EmptyState「高级配置」button SHALL accept a `hideAdvanced` prop.
- In PRO state (`hideAdvanced` true), the EmptyState SHALL NOT render the「高级配置」button (phase tabs already provide 设定/大纲).
- In free state, the button SHALL remain rendered.

#### Scenario: PRO empty-project hides EmptyState advanced
- Given a PRO session with an empty project tree (EmptyState visible)
- When the workspace renders
- Then the EmptyState「高级配置」button is not rendered

#### Scenario: Free empty-project keeps EmptyState advanced
- Given a free session with an empty project tree
- When the workspace renders
- Then the EmptyState「高级配置」button is rendered with the「可选」badge

### Requirement: E2E 适配双入口并存

- The `creation-flow.spec.ts` PRO (trial) cases SHALL enter the settings view via the phase tab「设定」, not the hidden top-bar dropdown.
- The now-unused `openAdvanced` helper SHALL be removed from `creation-flow.spec.ts`.
- The `free-writing-flow.spec.ts` free-state「高级配置」selector SHALL target the NovelBar button precisely (`getByTitle`), because in an empty project both the NovelBar dropdown and the EmptyState button render the same text「高级配置」and a role-name selector would match two elements (Playwright strict mode).

#### Scenario: PRO 简介门控用例进入设定
- Given a trial session with a fresh novel
- When the test clicks the phase tab「设定」
- Then the settings view renders with the synopsis card visible

#### Scenario: PRO 设定 7 项确认用例进入设定
- Given a trial session with all 7 settings pending
- When the test clicks the phase tab「设定」
- Then the settings view renders and the world-setting panel is reachable

#### Scenario: Free empty project opens NovelBar dropdown unambiguously
- Given a free session with an empty project
- When the test clicks the NovelBar「高级配置 ▾」via its title
- Then the dropdown menu opens and the settings view is reachable
