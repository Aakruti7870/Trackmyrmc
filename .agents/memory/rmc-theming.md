---
name: RMC runtime theming
description: How TrackMyRMC is themed — one warm-cream palette for both Day and Night, dark forest-green header bar, amber accent.
---

# RMC theming (warm-cream + forest-green; same look day and night)

Themes are defined in `rmc-app/src/lib/theme.tsx` as CSS-var tokens applied inline to `documentElement`.
ONE universal palette, two mode IDs (concrete-gold = day, infra-green = night) that now share identical colours.

## Palette (both concrete-gold and infra-green)
- **Body bg:** `#F0ECDA` (warm cream)
- **Panel/surface:** `#FFFFFF` (white cards)
- **Text:** `#1A2A14` (deep forest green-black)
- **Muted:** `#6A7B5E`
- **Accent (--gold):** `#D4941A` (golden amber — replaces old teal everywhere)
- **Gold-hi/mid:** `#E8A820` / `#D4941A`
- **Header bg:** `rgba(27,61,41,0.97)` (dark forest green)
- **Header text:** `#FFFFFF`
- **Header accent:** `#D4941A` (amber logo badge)

## Header CSS-var scoping pattern
`DeliveryMobileChrome.tsx` — the mobile header div overrides CSS custom properties in its own inline style so ALL child components (NotificationBell, AiHeaderButton, etc.) inherit header-appropriate colours without per-component changes:
```tsx
style={{
  background: 'var(--header-bg)',
  '--text': 'var(--header-text)',
  '--muted': 'var(--header-muted)',
  '--gold': 'var(--header-accent)',
  '--surface': 'var(--header-surface)',
  '--line': 'var(--header-border)',
} as CSSProperties}
```
The bottom nav keeps `var(--surface)` (white) — only the top header gets the dark green.

## New header tokens (in every theme + :root fallback + automatic-theme.css)
- `--header-bg` / `--header-text` / `--header-muted`
- `--header-accent` / `--header-surface` / `--header-border`

## Trust Blue removed
Trust Blue was the third theme and has been removed from THEMES[] and the ProfileSettings picker.
`LEGACY_ID_MAP` maps stored `'trust-blue'` pref → `'concrete-gold'` for graceful migration.
`ThemeMode` type no longer includes `'trust-blue'`.

## Day/night look
Both themes intentionally share the same warm-cream palette — `resolveTheme` still returns
`concrete-gold` by day and `infra-green` by night (logic unchanged, autoTheme.test.ts passes),
but since both token sets are identical the user sees the same light appearance around the clock.
`applyTheme` always sets `colorScheme = 'light'` (both themes are light-background).

## Override trap — keep IN SYNC when changing colours
- `src/lib/theme.tsx` — SHARED_TOKENS / HEADER_TOKENS (source of truth)
- `src/automatic-theme.css` — `:root` + `:root[data-theme='concrete-gold']` + `:root[data-theme='infra-green']`
- `src/index.css :root` — pre-hydration fallback baseline
- `src/pages/ProfileSettings.tsx` opts[] — swatch hex values for the theme picker
- `src/components/DeliveryMobileChrome.tsx` — header CSS-var scope (no hard-coded hex, all via tokens)

**How to apply:** after any palette change, `rg rmc-app/src` for stray old hexes (`#178A6E`, `#12211D`, `#0C1713`, `#EAF4F0`) and run the `lint` + `build` + `test` workflows.
