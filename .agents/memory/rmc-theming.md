---
name: RMC runtime theming
description: How the multi-theme system works and the migration pitfalls when adding/editing themes in rmc-app.
---

# RMC runtime multi-theme system

The app ships 6 dark themes + 1 LIGHT theme (`daylight-glass`, THEMES[0] = the
DEFAULT) via CSS custom properties swapped on `document.documentElement`
(provider in `rmc-app/src/lib/theme.tsx`, tokens defined in
`rmc-app/src/index.css`). Theme id persists in localStorage (`rmc-theme`) and is
applied at module load to avoid a flash.

## Surface-kit completeness rule (light/dark)
`applyTheme()` only writes the keys present in a theme's `tokens`, so a key set
by a previous theme but ABSENT from the next stays stale on switch. The shell
surfaces (shadow-rgb, glass-*, sidebar-*, header-bg, menu-bg/hover, overlay,
chip-bg, sheen) live in two kits — `LIGHT_SURFACES` / `DARK_SURFACES` — and
EVERY theme must spread the matching kit (light spreads LIGHT, all 6 darks spread
DARK). Add a new surface token to BOTH kits or switching half-themes the shell.
**Why:** the light default introduced surfaces the old dark-only themes never
declared; without spreading the kit you get dark-on-dark / white-on-white.

## Public/auth pages are pinned LIGHT by design
Landing (`Landing.tsx`/`Landing.css` local `.ck` palette), Login/Register/
SetPassword and Privacy are intentionally fixed to the Daylight Glass light look
— logged-out pages have NO theme switcher, so they don't need to track dark
themes. Clerk's `appearance.variables` in `main.tsx` must also be LIGHT
(`colorBackground:#fff`, ink `#0f172a`, primary `#d68a0a`) or the Clerk auth UI
renders dark on the now-light login page.

## Token model
Base: `--bg/--bg-top/--bg-deep/--panel/--panel2/--surface/--line`;
text: `--text/--muted`; accent ramp: `--gold-hi/--gold-mid/--gold/--gold-dark`;
glow: `--glow-1/--glow-2`; font: `--font-app`. Semantic
`--green/--green-dark/--blue/--red` are pinned IDENTICALLY in every theme so
status meaning never shifts — do not theme them.

## The accent-tint pitfall (most important)
This started as a single gold (`#f7c948` = rgb 247,201,72) design. When making
it multi-theme, it is NOT enough to migrate accent *text/border* colors to
`var(--gold)`. Any **tinted background** built from the old accent —
`rgba(247,201,72,α)` or amber shadows `rgba(255,183,3,α)` — stays yellow on
non-gold themes, producing e.g. cyan/pink text on a faint yellow chip.

**Rule:** every accent-derived tint must become
`color-mix(in srgb, var(--gold) N%, transparent)` (N = α×100), and brand
gradient mid/end stops must use the ramp (`var(--gold-mid)`, `var(--gold-dark)`)
not literal `#ffb703/#a16207`. **Why:** the accent hue changes per theme; literal
amber tints/gradients are the single most visible source of mismatched combos.

## Intentional exclusions (do NOT migrate to vars)
- `ChallanPrint.tsx` — printed challan must stay fixed; has `@media print` white bg.
- `LiveGPSTracker.tsx` — marker/route colors are dynamic, not themed.
- Per-theme glow literals inside `theme.tsx` THEMES maps and the `:root`
  fallback defaults in `index.css` are real rgba values by design — keep them.

## Capturing per-theme samples
There is no `?theme=` URL override in committed code. To screenshot each theme,
temporarily let `readStored()` honor a `?theme=` query param, capture
`/login?theme=<id>`, then REVERT the override and rebuild before finishing.
