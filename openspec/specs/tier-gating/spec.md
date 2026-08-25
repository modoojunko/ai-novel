# tier-gating Specification

## Purpose
TBD - created by archiving change 003-two-tier-foundation. Update Purpose after archive.

## Requirements

### Requirement: License tier single source of truth

- The system SHALL provide a `LicenseProvider` React context mounted above the novel workspace that exposes the current user's tier to all descendants.
- On mount, the provider SHALL call `POST /auth/verify` at most once and cache the response at module level, so remounting or multiple provider instances do not issue duplicate requests.
- The provider SHALL expose `{ tier, isFree, isPro, trialRemainingDays, loading, error, refetch }`.
- `isFree` SHALL be `true` when `tier === "none"`; `isPro` SHALL be the negation.
- On network failure or non-OK response, the provider SHALL degrade to `tier: "none"` (`isFree: true`) and set `error`, without throwing to the tree.
- `refetch` SHALL clear the module-level cache, re-run `POST /auth/verify`, and update state.

#### Scenario: Provider fetches tier once
- Given a mounted LicenseProvider with no cached verify result
- When it mounts
- Then it calls `POST /auth/verify` once and provides `{tier, isFree, isPro}` to descendants

#### Scenario: Remount reuses cached tier
- Given a LicenseProvider that has already fetched a paid tier
- When a new provider instance mounts without refetch
- Then no additional `POST /auth/verify` request is issued and descendants receive the cached tier

#### Scenario: Free tier reports isFree
- Given a verify response with `tier: "none"`
- When the provider state is computed
- Then `isFree` is true and `isPro` is false

#### Scenario: Verify failure degrades to free
- Given `POST /auth/verify` rejects
- When the provider finishes its fetch
- Then `tier` is "none", `isFree` is true, `error` is set, and no exception escapes

### Requirement: useTier hook

- The system SHALL provide a `useTier()` hook returning the nearest `LicenseContext` value.
- When called outside a `LicenseProvider`, the hook SHALL return safe defaults `{ tier: "none", isFree: true, isPro: false, loading: false, error: null, refetch }` and SHALL NOT throw.

#### Scenario: Descendant reads tier
- Given a component inside a LicenseProvider
- When it calls `useTier()`
- Then it receives the provider's `{tier, isFree, isPro}`

#### Scenario: useTier outside provider is safe
- Given a component not wrapped by LicenseProvider
- When it calls `useTier()`
- Then it receives free defaults without throwing

### Requirement: Feature capability registry

- The system SHALL provide `lib/features.ts` defining a `FeatureKey` union type, a `FEATURES: Record<FeatureKey, {free: boolean}>` map, and a pure function `isFeatureEnabled(key, tier): boolean`.
- `isFeatureEnabled` SHALL return `true` for features whose `free` flag is true, regardless of tier.
- For features whose `free` flag is false, it SHALL return `true` only when `tier !== "none"` (paid).
- Free-enabled keys SHALL be exactly: `tree-crud`, `prose-edit`, `version-history`, `archive`, `volume-chapter-config`, `advanced-config-entry`, `settings-7-items`.
- Free-locked keys SHALL be exactly: `settings-ai-fields`, `outline-advanced-fields`, `ai-generate`, `prompt-panel`, `ai-model`.
- The module SHALL have no DOM dependency (pure TS).

#### Scenario: Free disabled AI features
- Given a tier of "none"
- When `isFeatureEnabled("ai-generate", "none")` is evaluated
- Then it is false

#### Scenario: Paid enables AI features
- Given a paid tier such as "monthly"
- When `isFeatureEnabled("ai-generate", "monthly")` is evaluated
- Then it is true

#### Scenario: Free core writing features always enabled
- Given a tier of "none"
- When `isFeatureEnabled("prose-edit", "none")` and `isFeatureEnabled("archive", "none")` are evaluated
- Then both are true

### Requirement: TierGate and TierField components

- The system SHALL provide `components/novel/license/FeatureTier.tsx` exporting `TierGate` and `TierField`.
- `<TierGate feature>` SHALL render its children only when `isFeatureEnabled(feature, tier)` is true; otherwise render nothing.
- `<TierField feature locked>` SHALL render the field skeleton; when the feature is disabled, it SHALL render a lock indicator (🔒 / "属 PRO") and disable interaction, preserving the field structure for the paid unlock.

#### Scenario: Free hides AI subtree
- Given a tier of "none"
- When `<TierGate feature="ai-generate"><Button/></TierGate>` is rendered
- Then no Button is rendered

#### Scenario: Pro renders gated content
- Given a paid tier
- When `<TierGate feature="ai-generate"><Button/></TierGate>` is rendered
- Then the Button is rendered

#### Scenario: Free shows locked field
- Given a tier of "none"
- When `<TierField feature="settings-ai-fields" locked>…</TierField>` is rendered
- Then a lock indicator is present and the inner input is disabled
