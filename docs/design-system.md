# BUILD PLAY — Design System v2

## Principles

- **Hybrid light UI**: calm surfaces, single teal accent, minimal gradients.
- **RTL-first**: Hebrew copy, logical spacing, `dir="rtl"` on shell.
- **Touch**: minimum target `2.75rem` (`--bp-touch-min`).

## Tokens (`index.css`)

| Token | Usage |
|-------|--------|
| `--surface-0` | App background |
| `--surface-1` | Cards, panels |
| `--surface-2` | Subtle sections |
| `--text-secondary` | Meta labels |
| `--primary` | Actions, links |

## Utilities

- `app-shell-bg` — page background (soft gradient)
- `bp-surface-card` — standard card without heavy glass
- `bp-glass-strip` — header only
- `text-secondary` — muted body text

## Components

- `StatusChip` — status pills (matched / warning / danger)
- `StepIndicator` — mobile wizard steps (בנה → התאם → פלייליסט)
- `EmptyState` — empty lists / no results
- `TouchBar` / `TouchBarButton` — mobile footer actions (min touch height)

## Breakpoints

- Mobile: `< 768px` (`useIsMobile`, `md:` in Tailwind)
- Desktop: `≥ 768px`

## Motion

Respect `prefers-reduced-motion: reduce` (global in `index.css`).
