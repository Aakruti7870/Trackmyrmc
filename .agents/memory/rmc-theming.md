---
name: RMC runtime theming
description: Single auto-only day/night theme — Midnight Forest + Clean Amber. No user picker. Switches at exact sunrise/sunset.
---

# RMC theming — Midnight Forest + Clean Amber, auto-only

Themes live in `rmc-app/src/lib/theme.tsx` as CSS-var tokens applied inline to `documentElement`.

## Architecture

- **ThemeMode = 'auto' only** (locked). `readThemePreference` always returns 'auto' and clears any legacy stored preference. `writeThemePreference` is a no-op. Users cannot change the theme.
- **Theme picker removed** from ProfileSettings.tsx.
- **Two internal theme IDs** still exist (`concrete-gold` = day, `infra-green` = night), resolved by `resolveTheme('auto')` based on sunrise/sunset. The `ThemeProvider` runs geolocation + precise `setTimeout` at each crossing + 60 s polling fallback.
- `applyTheme` sets `colorScheme = 'light'` for concrete-gold and `colorScheme = 'dark'` for infra-green so WebView scrollbars and status-bar contrast are correct.

## Day palette (concrete-gold — active from sunrise to sunset)
- **Body bg:** `#EEF2F7` (cool Slate)
- **Panel/surface:** `#FFFFFF`
- **Text:** `#0D1421` | **Muted:** `#4B5568`
- **Accent (--gold):** `#F59E0B` | **gold-hi:** `#FBBF24`
- **Header bg:** `rgba(10,28,18,0.97)` (deep midnight forest) | **header-accent:** `#FBBF24`
- **chip-bg:** `#E4EBF5` | **line:** `rgba(13,20,33,0.09)`

## Night palette (infra-green — active from sunset to sunrise)
- **Body bg:** `#0A0F1C` (deep navy) | **bg-top:** `#0D1421`
- **Panel:** `#111827` | **surface:** `#141D2E`
- **Text:** `#E8EEF7` | **Muted:** `#7A8BA8`
- **Accent (--gold):** `#FBBF24` | **gold-hi:** `#FCD34D`
- **Header bg:** `rgba(5,10,7,0.97)` (near-black forest) | **header-accent:** `#FCD34D`
- **chip-bg:** `#1E2B3F` | **line:** `rgba(232,238,247,0.09)`
- **gold-soft/tint:** rgba() dark amber overlays (not solid hex, no light leak)

## Header CSS-var scoping pattern
`DeliveryMobileChrome.tsx` — the mobile header div overrides CSS custom properties so all child components (NotificationBell, AiHeaderButton, etc.) inherit header colours without per-component changes:
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

## Override trap — keep IN SYNC when changing colours
- `src/lib/theme.tsx` — SHARED_TOKENS / HEADER_TOKENS / NIGHT_TOKENS / NIGHT_SURFACES / NIGHT_ACCENT (source of truth)
- `src/automatic-theme.css` — `:root[data-theme='concrete-gold']` (Slate light) + `:root[data-theme='infra-green']` (deep dark navy)
- `src/index.css :root` — pre-hydration fallback baseline (day palette)
- `src/components/DeliveryMobileChrome.tsx` — header CSS-var scope (no hard-coded hex)

**How to apply:** after any palette change, `rg rmc-app/src` for stray old hexes and run `lint` + `build`.
