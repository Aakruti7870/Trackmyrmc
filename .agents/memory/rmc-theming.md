---
name: RMC runtime theming
description: How CONCRETE KING's single teal Day/Night theme is wired and the override traps to avoid.
---

# RMC theming (teal Day/Night)

The app ships ONE universal teal-green + white corporate theme with two modes, Day (light, default) and Night (dark). Defined in `rmc-app/src/lib/theme.tsx` as CSS-var tokens applied to `documentElement`. Accent tokens keep legacy `--gold*` key names but now hold a teal ramp.

**Why:** legacy keys (`--gold`, `--gold-hi/mid/dark`) are referenced all over the codebase; renaming them would be a huge churn, so the teal values live under the old names.

**Override trap (cost a debugging cycle):** `var(--gold)` rendered as the OLD amber on the Landing page even after theme.tsx was teal, because **other CSS layers redefined the same custom property closer to the element**:
- `src/index.css :root { --gold: ... }` (stylesheet baseline)
- `src/pages/Landing.css .ck { --gold: ... }` (scoped to Landing's `.ck` wrapper — this beats the inline `documentElement` token for descendants because the nearest ancestor that defines a custom property wins)
- `rmc-app/index.html` static pre-React shell uses hardcoded hex inline styles

**How to apply:** when changing accent colors, the teal value must be set in ALL of: theme.tsx tokens, `src/index.css`, `src/pages/Landing.css`, and the static `index.html` shell — or one layer silently overrides the others. After any accent change, scan `rmc-app/src` + `index.html` for legacy literals (`#d68a0a #f5b942 #f7c948 #e59a16`, rgba `247,201,72` / `214,138,10`).

**Intentional non-teal:** `--orange` token + semantic amber (`#f59e0b/#facc15/#f97316`) for warnings, lock-expiring badges, role badges (plant_owner), and unverified-plant alerts stay distinct — do NOT tealify them. The Landing mixer-truck SVG illustration keeps amber gradient stops (`#fbd36b/#f0b429`) as a realistic vehicle.
