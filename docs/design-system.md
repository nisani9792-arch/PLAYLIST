# JUSIC PLAY — Design System v3

## Principles

- **Brand UI**: soft grey-blue surfaces, logo cyan accent, neutral grey highlights, readable contrast and clear card shadows.
- **RTL-first**: Hebrew copy, logical spacing, `dir="rtl"` on shell.
- **Touch**: minimum target `2.75rem` (`--bp-touch-min`).
- **Responsive**: mobile-first wizard; desktop 3-column studio layout.

## Tokens (`index.css`)

| Token | Usage |
|-------|--------|
| `--surface-0` | App background |
| `--surface-1` | Cards, panels |
| `--surface-2` | Subtle sections |
| `--text-secondary` | Meta labels |
| `--primary` | Actions, links (teal) |
| `--accent-gold` | Parasha, success highlights |

## Utilities

- `app-shell-bg` — aurora page background
- `bp-surface-card` — standard card
- `bp-glass-strip` — header strip
- `text-secondary` — muted body text

## Components

- `StatusChip` — matched / warning / danger
- `StepIndicator` — mobile wizard (בנה → התאם → פלייליסט)
- `TopicChip` — quick topic suggestions
- `VibeBadge` — mood/tact indicator
- `PlaylistProgressRing` — song count progress
- `SongCard` — song row with artist + genre
- `HashkafaShield` — kosher filter indicator
- `EmptyState`, `TouchBar`

## Breakpoints

- Compact: `< 640px`
- Mobile: `< 768px`
- Studio: `≥ 1024px`
- Wide: `≥ 1280px`

## Motion

Respect `prefers-reduced-motion: reduce`.
