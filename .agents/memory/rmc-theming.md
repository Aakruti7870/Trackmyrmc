---
name: RMC runtime theming
description: How TrackMyRMC is themed — one universal teal Day/Night pair with clock-driven Auto mode, and the CSS-var override layers to keep in sync.
---

# RMC theming (flat, token-driven; Day/Night + Auto)

Themes are defined in `rmc-app/src/lib/theme.tsx` as CSS-var tokens applied inline to `documentElement` (inline wins over `index.css :root` fallbacks). ONE universal design, two modes:
- **Concrete Gold (Day / Light):** bg `#F4F7F5`, ink `#12211D`, muted `#6B7C76`, teal accent `--gold: #178A6E`, `--gold-hi: #1FA882`, `--gold-dark: #0E6650`.
- **Infra Green (Night / Dark):** bg `#0C1713`, panel `#121F1B`, text `#EAF4F0`, brighter teal `--gold: #27B58C`, `--gold-hi: #34D19E`, `--gold-dark: #1FA882`.

The old olive-gold palette (`#8B923F`/`#9BA342`) was replaced with the above teal palette. If stale olive hex appears in a grep, it must be updated.

**Theme picker exists in ProfileSettings:** Users CAN explicitly select Concrete Gold / Trust Blue / Infra Green from their profile. Auto-mode (default) uses clock-driven concrete-gold Day / infra-green Night. Trust Blue (`#2563eb`) is the manually-selectable alternate light theme. The `readThemePreference` / `writeThemePreference` helpers persist the choice under `rmc-theme-pref-v2`.

**No automatic theme-mode switcher in the header:** the old `ThemeSwitcher` UI was removed from the header chrome. ThemeCtx is `{theme, themes, preference, setPreference}`; module load applies `resolveTheme(readThemePreference())` synchronously (no flash). ThemeProvider re-resolves every 60s + on visibilitychange while in auto.

**Accent tokens keep legacy `--gold*` names** (`--gold`, `--gold-hi/mid/dark`, soft tints `--gold-soft/-tint`, `--prompt-bg/-border/-icon-bg`) referenced all over. Don't rename — huge churn.

**Override trap:** keep these IN SYNC when changing the accent or base palette:
- `src/lib/theme.tsx` — token source of truth (CG_ACCENT / IG_ACCENT / CG_SURFACES / IG_SURFACES).
- `src/index.css :root { ... }` — pre-hydration Day fallback baseline.
- `src/automatic-theme.css` — CSS data-theme attribute fallbacks for both themes.
- `src/pages/ProfileSettings.tsx` opts[] — swatch hex values for the theme picker UI (update to match accent).
- `src/main.tsx` — Clerk `appearance.variables` read `var(--gold)` from computedStyle dynamically; no hard hex to update.
- `rmc-app/index.html` `#ck-static-shell` — static pre-React shell uses old hex (replaced instantly on React mount, retint by hand if it ever matters).

**SplashScreen exception:** `SplashScreen.tsx` has a hardcoded white (`#FFFFFF`) background and uses dark hex (`#111110`, `#8A8A85`) for the wordmark and subtitle text — intentional, because `var(--text)` would flip to near-white in Night mode against the white splash bg. The brand mark gradient and progress bar DO use `var(--gold-hi)` / `var(--gold-dark)`.

**Theme reach:** ALL screens are token-driven, including public pages (Landing, Login, Privacy/Terms/DeleteAccount, SsoCallback, partner) and chrome. `ChallanPrint.tsx` white is an intentional paper print view. Map-pin SVGs are still hardcoded teal — known minor gap.

**How to apply:** after any palette change, `rg rmc-app/src` for stray old hexes (`#8B923F`, `#9BA342`, `#707439`, `#F2F2F0`, `#1F1F1E`) and run the `lint` + `build` + `test` workflows.
