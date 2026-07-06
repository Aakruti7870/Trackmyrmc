---
name: RMC runtime theming
description: How CONCRETE KING is themed — a SINGLE flat warm-white theme, no photo backgrounds, and the CSS-var override layers to keep in sync.
---

# RMC theming (single flat warm-white theme; day/night collapsed)

Themes are defined in `rmc-app/src/lib/theme.tsx` as CSS-var tokens applied to `documentElement`. The old two-mode Day/Night (and earlier 3 dark variants) were **collapsed to ONE flat theme**: id `day`, name `Simple` — warm-white bg `#fdfbf7`, surface `#fff`, ink text `#1c1917`, muted `#78716c`, teal accent `#0f766e`. Surfaces are FLAT (`FLAT_SURFACES`: no blur, no glows) with `FLAT_ACCENT`. There is no night/dark mode anymore.

**Accent tokens keep legacy `--gold*` names** (`--gold`, `--gold-hi/mid/dark`) referenced all over the codebase; they now hold the **teal** ramp (`#0f766e`). Don't rename them — huge churn.

**Override trap:** `var(--gold)` (and any token) can render the WRONG color even after theme.tsx changes, because other layers redefine the same custom property closer to the element / earlier in the paint. Keep these IN SYNC when changing the accent or base palette:
- `src/lib/theme.tsx` — the token source of truth.
- `src/index.css :root { ... }` — the pre-hydration fallback baseline (now the same flat warm palette; body bg is flat `var(--bg)`, no `body::before` glow, `.glass-card` is solid with a soft shadow and no backdrop-filter).
- `rmc-app/index.html` `#ck-static-shell` — static pre-React shell uses **hardcoded hex inline styles** (no CSS vars); retint by hand.
- `src/main.tsx` — the **Clerk `appearance.variables`** are hardcoded hex, NOT tokens.

**NO background photos anywhere.** The user explicitly wants a flat theme with no photo backgrounds (login illustration is the one allowed image). `AppBackground.tsx` is a no-op (returns null); `CommandCenter.tsx` control-room backdrop divs were removed; the 4 auth pages (Register/ForgotPassword/PartnerRequest/SetPassword) use `background: 'var(--bg)'` instead of the old `rmc-aerial-bg.png`.

**Landing is self-contained and now FLAT too:** `src/pages/Landing.tsx` uses inline styles with a local palette const `C` — retinted to the flat warm-white scheme (teal `#0f766e`, bg `#fdfbf7`, panel `#fff`, dark ink text). The old cinematic `PhotoBg` (real photo drum image) + `drumImg` import were **removed**; the `Glass` card is now a flat white card (soft shadow, no backdrop blur). Auth CTAs still SPA-navigate to `/login` via `history.pushState` + `PopStateEvent`. `Landing.css` is unused.

**Login is a fixed warm light screen** (`src/pages/Login.tsx`) with its own local `C` palette — phone-first (customer OTP default) with a "Staff login with email" door; keeps the warm illustration (`warm-concrete-illustration.png`). It intentionally ignores the runtime theme so sign-in always reads the same (PhonePe/Rapido style).

**How to apply:** after any accent/palette change, `rg` `rmc-app/src` + `index.html` for stray palette drift. `ChallanPrint.tsx` is a **paper print view** — its white background is intentional.

**Intentional non-teal (do NOT recolor):** per-role badge colors in `Layout.tsx` are semantic role identities; semantic amber/red/green/blue for warning/danger/success/info stay distinct.
