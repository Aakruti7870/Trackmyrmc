---
name: RMC runtime theming
description: How CONCRETE KING's themes are wired, the cinematic-teal dark default, and the CSS-var override layers to keep in sync.
---

# RMC theming (dark cinematic TEAL is the DEFAULT)

Themes are defined in `rmc-app/src/lib/theme.tsx` as CSS-var tokens applied to `documentElement`. All variants are **DARK — there is no white/light theme**:
- `THEMES[0]` = **"Cinematic"** (id `king`) — the default. `--bg #050A0C`, teal accent ramp `--gold #00C9A7`.
- `THEMES[1]` = **"Obsidian"** (id `night`) — deepest black-teal.
- `THEMES[2]` = **"Steel"** (id `day`) — a LIGHTER charcoal-teal (still dark, NOT white).

**Accent tokens keep legacy `--gold*` names** (`--gold`, `--gold-hi/mid/dark`) referenced all over the codebase; they now hold the **teal** ramp (`#00C9A7`). Don't rename them — huge churn. Palette: teal `#00C9A7`, text `#E8F0EE`, muted `#7A8F8D`, glass border `rgba(0,201,167,.15)`. Fonts: Inter (+ JetBrains Mono) via `FONT_URLS['Inter']`.

**Override trap:** `var(--gold)` (and any token) can render the WRONG color even after theme.tsx changes, because other layers redefine the same custom property closer to the element / earlier in the paint. Keep these IN SYNC when changing the accent or base palette:
- `src/lib/theme.tsx` — the token source of truth (per-variant).
- `src/index.css :root { ... }` — the pre-hydration fallback baseline.
- `rmc-app/index.html` `#ck-static-shell` — static pre-React shell uses **hardcoded hex inline styles** (no CSS vars); retint by hand.
- `src/main.tsx` — the **Clerk `appearance.variables`** (colorBackground/Text/Input…) are hardcoded hex, NOT tokens; must be set to dark teal or the Clerk auth modals render light.

**Landing is self-contained:** `src/pages/Landing.tsx` is a 5-slide full-screen cinematic deck using **inline styles** (100vh, overflow hidden). It does NOT import `Landing.css` — that file is now UNUSED. Auth CTAs SPA-navigate to `/login` via `history.pushState` + `PopStateEvent` (wouter listens to popstate).

**Landing backgrounds must be REAL PHOTOS, not canvas art.** The reference mockup is photographic (wet teal-lit mixer drum, trucks on a night highway, etc). An earlier attempt drew the backgrounds with `<canvas>` and looked cheap — the user rejected it hard. Each slide now uses a `PhotoBg` component (an `<img objectFit:cover>` + a per-slide dark legibility gradient overlay) backed by AI-generated assets in `rmc-app/src/assets/landing/slide{1..5}-*.png`, imported at the top of Landing.tsx. **Why:** fidelity to the cinematic mockup depends on real imagery; if regenerating, keep the dark/teal cinematic grade and a left/bottom gradient so the headline + KPI cards stay legible.

**How to apply:** after any accent/palette change, `rg` `rmc-app/src` + `index.html` for stray LIGHT literals: `#ffffff`/`#fff` used as a *page/card background* (not white-on-button text), `#0f172a`, `#5a6b85`, `#eef2f9`, `rgba(255,255,255,.6+)` as a *surface*. Most `color:'#fff'` on teal/red buttons and `rgba(255,255,255,.02-.08)` overlays are fine on dark and should be left alone. `ChallanPrint.tsx` is a **paper print view** — its white background is intentional, do NOT darken it.

**Intentional non-teal (do NOT recolor):** per-role badge colors in `Layout.tsx` are semantic role identities; semantic amber/red/green/blue for warning/danger/success/info stay distinct.
