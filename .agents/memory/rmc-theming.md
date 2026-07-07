---
name: RMC runtime theming
description: How CONCRETE KING is themed — user-switchable flat themes (Simple teal default + Daylight terracotta), no photo backgrounds, and the CSS-var override layers to keep in sync.
---

# RMC theming (flat, user-switchable; token-driven)

Themes are defined in `rmc-app/src/lib/theme.tsx` as CSS-var tokens applied inline to `documentElement` (inline wins over `index.css :root` fallbacks). Two opt-in flat themes now ship: id `day`/name `Simple` (default — warm-white bg `#fdfbf7`, ink `#1c1917`, muted `#78716c`, **teal** accent `#0f766e`, Inter) and id `daylight`/name `Daylight` (warm paper, ink `#2d3a3a`, muted `#7a8a8a`, **terracotta** accent `#c85a32`, Outfit font — added to `FONT_URLS`). Both share white cards + FLAT surfaces (no blur/glows). No night/dark mode.

**Adding a theme = add a THEMES entry (accent+surface+tint token sets) + its font URL.** Both theme switchers (Layout user-menu swatch + ProfileSettings `ThemeSwitcher`) auto-list `themes`, so no switcher edits needed.

**Accent tokens keep legacy `--gold*` names** (`--gold`, `--gold-hi/mid/dark`, plus soft tints `--gold-soft/-tint`, `--prompt-bg/-border/-icon-bg`) referenced all over; they hold the active theme's ramp. Don't rename — huge churn.

**Theme reach trap (role-home + mobile chrome):** the mobile delivery kit `rmc-app/src/pages/home/deliveryKit.tsx` and the 8 role-home screens (`src/pages/home/*Home.tsx`) originally HARDCODED the Simple palette (`#0f766e`, ink `#1c1917`, muted `#78716c`). Those bypass tokens and DON'T re-skin. deliveryKit constants + role-home header/StatCard colors are now `var(--...)`. Any new home/chrome surface MUST use tokens (or deliveryKit's `TEAL/INK/MUTED`), never raw hex, or it silently stays Simple-colored under Daylight. `GREEN/BLUE/RED` stay semantic hex on purpose. Map-pin SVGs (raw HTML marker strings) are still hardcoded teal — a known minor gap.

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
