---
name: RMC runtime theming
description: How CONCRETE KING's themes are wired, the King dark/gold default, and the CSS-var override traps to avoid.
---

# RMC theming (King dark-navy + metallic-gold is the DEFAULT)

Themes are defined in `rmc-app/src/lib/theme.tsx` as CSS-var tokens applied to `documentElement`. `THEMES[0]` is **"King"** — a dark-navy (`--bg #090d14`, `--panel #10151f`) + metallic-gold ramp (`--gold #d4af37`, `--gold-hi #f3d87a`, `--gold-dark #a9821a`) premium theme, and it is the default. Older teal Day/Night themes still exist further down the array but are no longer the default.

**Why King is forced on everyone:** the persisted theme key was bumped `rmc-theme` → `rmc-theme-v2`, so existing users fall back to `THEMES[0]` (King) instead of a stored teal choice.

**Accent tokens keep legacy `--gold*` names** (`--gold`, `--gold-hi/mid/dark`) referenced all over the codebase; they now hold the gold ramp. Don't rename them — huge churn.

**Override trap (cost a debugging cycle):** `var(--gold)` can render the WRONG color even after theme.tsx changes, because other CSS layers redefine the same custom property closer to the element. The nearest ancestor that defines a custom property wins:
- `src/index.css :root { --gold: ... }` (stylesheet baseline)
- `src/pages/Landing.css .ck { --gold: ... }` — Landing uses a SELF-CONTAINED `.ck` palette (NOT the global theme tokens); it must be flipped separately.
- `rmc-app/index.html` static pre-React shell uses hardcoded hex inline styles.

**How to apply:** when changing accent colors, set the value in ALL of: `theme.tsx` tokens, `src/index.css`, `src/pages/Landing.css`, and the static `index.html` shell — or one layer silently overrides the others. After any accent change, `rg` `rmc-app/src` + `index.html` for stray literals: old teal (`178a6e`, `rgba(23,138,110`, `rgba(18,64,58`, `3fc7a4`, `0f6e57`) and stray magenta (`e879f9`) that predate the gold brand.

**Brand-consistency gotchas found during the re-skin:**
- `var(--gold, #178a6e)` fallbacks are harmless (the var is always defined now) — no need to edit them.
- The gold crown LOGO is an image at `@/assets/logo-king.png` (transparent PNG) — use `<img>` everywhere the old `<Crown>` lucide icon appeared (Layout, Login, Landing, Terms, Privacy, InstallAppBanner, ClerkStaffLogin), not the SVG icon.
- The `.crown-sso-btn` glow (`crownGlow` keyframe + gradient) and the Landing mixer-drum SVG gradient both originally pulsed magenta/teal; tie them to gold tokens for strict metallic-gold consistency.

**Intentional non-gold (do NOT recolor):** per-role badge colors in `Layout.tsx` (e.g. `authority: '#e879f9'`) are semantic role identities, and semantic amber/red/green/blue for warnings/danger/success/info stay distinct.
