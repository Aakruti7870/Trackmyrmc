---
name: RMC runtime theming
description: How CONCRETE KING is themed — one universal teal Day/Night pair with clock-driven Auto mode, and the CSS-var override layers to keep in sync.
---

# RMC theming (flat, token-driven; Day/Night + Auto)

Themes are defined in `rmc-app/src/lib/theme.tsx` as CSS-var tokens applied inline to `documentElement` (inline wins over `index.css :root` fallbacks). ONE universal design, two modes: id `day` (cool mint page `#f4f7f5`, ink `#12211d`, muted `#6b7c76`, teal accent `#178a6e`, Inter) and id `night` (dark counterpart: bg `#0c1713`, panel `#12211d`, text `#eaf4f0`, brighter teal `#27b58c`). The old terracotta "Daylight" theme was REMOVED.

**No user-facing theme picker (July 2026):** the app is PERMANENTLY auto — THEME_MODES/ThemeSwitcher/persistMode/readStoredMode were removed; ThemeCtx is just `{theme, themes}`; module load deletes old localStorage mode keys and applies `resolveTheme('auto')` synchronously (no flash). Do not re-add a picker unless the user asks. Auto = `isNightNow()`: NOAA sunrise/sunset from coords in `rmc_nearby_location` localStorage (set by the Nearby screen), fallback 06:15/18:30 local. **Never prompt geolocation for theming** — privacy requirement; everything computes locally. ThemeProvider re-resolves every 60s + on visibilitychange while in auto.

**Accent tokens keep legacy `--gold*` names** (`--gold`, `--gold-hi/mid/dark`, soft tints `--gold-soft/-tint`, `--prompt-bg/-border/-icon-bg`) referenced all over. Don't rename — huge churn.

**Override trap:** keep these IN SYNC when changing the accent or base palette:
- `src/lib/theme.tsx` — token source of truth.
- `src/index.css :root { ... }` — pre-hydration fallback baseline (kept = Day values).
- `src/main.tsx` — Clerk `appearance.variables` are hardcoded hex (now light/teal `#178a6e`).
- `src/pages/Landing.tsx` local `C` + `src/pages/Login.tsx` local `C` — now `var(--…)` references (theme-driven, flip with Night); `Landing.css .ck` no longer defines local palette vars (it inherits the global tokens — do NOT reintroduce a local `--gold/--bg` block there).
- `rmc-app/index.html` `#ck-static-shell` — static pre-React shell still uses the OLD dark `#00C9A7` scheme (hardcoded inline hex); replaced instantly on React mount, retint by hand if it ever matters.

**Theme reach:** ALL screens are token-driven now, including the public pages (Landing, Login, Privacy/Terms/DeleteAccount, SsoCallback, partner) and chrome (InstallAppBanner, notifications) — old dark-gradient leftovers were tokenized. deliveryKit + 8 role-home screens read `var(--...)` tokens (never raw hex) so they flip with Night. `GREEN/BLUE/RED` semantic hex stay stable across modes on purpose; per-role badge colors in Layout are semantic identities — do NOT recolor. Map-pin SVGs (raw HTML marker strings) are still hardcoded teal — known minor gap. `ChallanPrint.tsx` white is an intentional paper print view. NO background photos anywhere (flat design; login illustration is the one allowed image).

**How to apply:** after any palette change, `rg` `rmc-app/src` for stray old hexes (`#fdfbf7`, `#1c1917`, `#78716c`, `#0f766e`-as-primary) and run the `lint` + `build` + `test` workflows.
