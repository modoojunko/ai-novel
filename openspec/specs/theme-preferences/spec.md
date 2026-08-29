# theme-preferences Specification

## Purpose

用户级界面主题（accent）偏好：主题集合契约、服务端持久化、登录态前端应用机制。S端 控制台提供选择 UI；接口与 CSS 机制对 C端 开放（现有 token 直接复用），供后续接入同步。目录 key 白名单单一事实源 = `server/app/domain/identity/theme.py`。


## Requirements

### Requirement: Theme catalog is a fixed contract shared by both frontends
- The system SHALL support a preset theme catalog whose keys and accent values are: `teal`（default, `oklch(48% 0.11 170)`）, `ink`（`oklch(37% 0.01 250)`）, `bamboo`（`oklch(60% 0.076 152)`）, `rouge`（`oklch(58% 0.11 8)`）, `wisteria`（`oklch(58% 0.084 296)`）, `celadon`（`oklch(65% 0.066 184)`）; each theme SHALL also define `--accent-strong`（约 L−6 同色相同 chroma）.
- Both frontends SHALL carry an identical `:root[data-theme="<key>"]` override layer for every non-default theme inside the `@cross` shared segment of `src/design/base.css`, machine-checked by `design:cross`.
- When no theme attribute is present, tokens SHALL resolve to the default teal values; the default state of both frontends SHALL be visually unchanged from pre-change baselines.
- Adding, renaming, or re-valuing a theme SHALL update the catalog registration in `docs/ux/cross-end.html` 色相登记簿 in the same batch.

#### Scenario: Default renders identical to today
- Given a user with no saved theme preference
- When any screen renders on either frontend
- Then no `data-theme` attribute is set and all accent elements render teal, pixel-identical to the pre-change baseline

#### Scenario: Same key resolves identically on both ends
- Given `data-theme="ink"` is applied on both frontends
- When accent color is computed
- Then both resolve `--accent` to `oklch(37% 0.01 250)` and `design:cross` reports zero drift in the override layer

### Requirement: Theme preference is stored server-side per user
- The backend SHALL persist the selected theme key on the user record (`users.theme`, default empty) via an alembic migration with idempotent DDL for existing deployments.
- `GET /api/user/me` SHALL include the user's theme key (empty string when unset) in its response.
- A new endpoint `PUT /api/user/preferences` SHALL accept `{ "theme": "<key>" }` from an authenticated user, validate the key against the catalog whitelist, persist it, and return the saved preference; an unknown key SHALL be rejected with 422 and SHALL NOT modify stored state.
- The theme key contract SHALL be shared by the C端 client API surface so C端 can read and write the same preference with its existing token, without backend changes in the C端 integration change.

#### Scenario: Persisting a choice
- Given an authenticated user whose stored theme is empty
- When `PUT /api/user/preferences` is called with `{"theme":"ink"}`
- Then the response confirms `theme:"ink"` and a subsequent `GET /api/user/me` returns `theme:"ink"`

#### Scenario: Rejecting an invalid key
- When `PUT /api/user/preferences` is called with `{"theme":"neon-pink"}`
- Then the API responds 422 and the stored theme remains unchanged

#### Scenario: C端 reuses the same contract
- Given a C端 desktop client holding a valid user token
- When it calls the same preferences endpoints
- Then it reads and writes the same per-user theme key with no backend modification

### Requirement: S端 console applies the theme at login and offers in-app selection
- After login/session restore, the S端 console SHALL apply the user's saved theme by setting `data-theme` on the document root before (or at) console entry; landing and auth pages SHALL always render the default theme.
- The S端 账户与安全 page SHALL offer a theme selector using catalog swatches built from existing component vocabulary (`.btn`/`.field` families, `--accent-soft` selected state), with button labels following the verb-first terminology rules.
- Selecting a theme SHALL apply immediately (no reload) and persist via the preferences API; failure to persist SHALL surface a retryable error notice with a clickable exit and revert the visual state only after explicit user action or reload.

#### Scenario: Theme follows the user across sessions
- Given a user who selected 玄墨 (ink) previously
- When they log in on a fresh browser session and enter the console
- Then the console renders with the ink accent without any manual re-selection

#### Scenario: Immediate apply with persisted state
- Given the user is on the 账户与安全 page
- When they click the 竹青 swatch
- Then the console accent changes to bamboo immediately, the selection state moves to 竹青, and a successful PUT follows; on page reload the bamboo theme persists

#### Scenario: Landing stays default
- Given a user whose saved theme is rouge
- When they visit the landing or auth page
- Then those pages render with the default teal accent
