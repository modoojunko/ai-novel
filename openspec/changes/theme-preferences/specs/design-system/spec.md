## MODIFIED Requirements

### Requirement: One shared token palette and theme
- Both frontends SHALL use one light theme built on identical oklch tokens (`--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, `--accent-strong`, `--accent-soft`, `--ok`/`--ok-soft`, `--warn`/`--warn-soft`, `--err`/`--err-soft`, `--fg-soft`) declared in each end's `src/design/base.css`; token drift between ends is a defect.
- The default accent SHALL remain teal (`--accent: oklch(48% 0.11 170)`, `--accent-strong: oklch(41% 0.10 170)`); user-selectable accent themes (catalog defined in the `theme-preferences` capability) SHALL be expressed only through a shared `:root[data-theme="<key>"]` override layer that redefines `--accent`/`--accent-strong` (soft variants keep deriving via `color-mix`), located inside the `@cross` shared segment in both frontends.
- Text on accent or dark surfaces SHALL use an explicit foreground token, never a borrowed surface or background token.
- Derived soft variants SHALL be produced with `color-mix(in oklch, …, transparent)`; raw hex/rgb literals are forbidden in either end's source.
- Status colors follow N6: red (`--err`) means irreversible-or-immediate actions only; cautionary-but-safe content uses `--warn` or accent.
- Introducing or retiring an accent hue — default or theme — SHALL be registered in the ux standard doc (`docs/ux/cross-end.html`) 色相登记簿 in the same batch as the token change; the registry tracks the theme catalog as a set, not a single brand hue.

#### Scenario: Same warning surface in either console

- Given a screen needs a persistent cautionary notice
- When it is styled
- Then it uses the warn soft background through the notice family and not red

#### Scenario: Accent renders as ink on both ends

- Given any screen on either frontend renders an accent element (primary button, logo mark, accent pill, breathing dot) under `data-theme="ink"`
- When its computed accent color is read
- Then it resolves to the ink hue oklch(37% 0.01 250) on both ends, and no theme override exists outside the shared `@cross` segment

#### Scenario: Default teal is untouched

- Given both frontends render without a `data-theme` attribute
- When accent color is computed
- Then it resolves to oklch(48% 0.11 170), identical to the pre-theme-system baseline
