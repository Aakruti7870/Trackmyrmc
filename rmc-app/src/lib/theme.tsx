import { createContext, useContext } from 'react';

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  fontName: string;
  font: string;
  tokens: Record<string, string>;
}

/**
 * Theme mode.
 * - 'auto'         → follow the device clock (sunrise/sunset): concrete-gold by day, infra-green by night.
 * - 'concrete-gold' / 'trust-blue' / 'infra-green' → explicit user-selected theme, persisted.
 */
export type ThemeMode = 'auto' | 'concrete-gold' | 'infra-green';

/* Semantic colors stay stable across all themes so status meaning never shifts. */
const SEMANTIC = {
  '--green': '#22c55e',
  '--green-dark': '#15803d',
  '--blue': '#38bdf8',
  '--red': '#B94040',   // approved controlled error red
  '--orange': '#f59e0b',
};

// ─── Shared header tokens — dark forest-green bar, amber accent, white ink ────
// Applied via CSS-var scoping on the mobile header element so every child
// component (NotificationBell, AiHeaderButton, etc.) inherits header colours
// without per-component changes.
const HEADER_TOKENS = {
  '--header-bg': 'rgba(27,61,41,0.97)',
  '--header-text': '#ffffff',
  '--header-muted': 'rgba(255,255,255,0.65)',
  '--header-accent': '#D4941A',
  '--header-surface': 'rgba(255,255,255,0.12)',
  '--header-border': 'rgba(255,255,255,0.15)',
};

// ─── Theme 1 & 2: Concrete Gold (Day) / Infra Green (Night) ──────────────────
// Both share the same warm-cream palette so the app looks identical day or night.
// Warm cream page, white cards, forest-green header bar, amber accent.
const SHARED_SURFACES = {
  '--shadow-rgb': '0,0,0',
  '--glass-1': '#ffffff', '--glass-2': '#F8F9FA',
  '--glass-border': 'rgba(0,0,0,0.10)', '--glass-hi': 'transparent', '--glass-blur': 'none',
  '--sidebar-1': '#ffffff', '--sidebar-2': '#F0F2F5',
  '--menu-bg': '#ffffff',
  '--menu-hover': 'rgba(0,0,0,0.06)', '--overlay': 'rgba(0,0,0,0.30)',
  '--chip-bg': '#E9ECEF', '--sheen': 'transparent',
  ...HEADER_TOKENS,
};
const SHARED_ACCENT = {
  '--gold-hi': '#E8A820', '--gold-mid': '#D4941A', '--gold': '#D4941A', '--gold-dark': '#9B6610',
  '--glow-1': 'rgba(212,148,26,0.16)', '--glow-2': 'transparent',
  '--gold-soft': '#FFF0CC', '--gold-tint': '#FFF8E6',
  '--prompt-bg': '#FFF3D0', '--prompt-border': 'rgba(212,148,26,0.20)', '--prompt-icon-bg': '#FFE0A0',
};

const SHARED_TOKENS = {
  '--bg-top': '#F4F5F7', '--bg': '#F0F2F5', '--bg-deep': '#E4E7EB',
  '--panel': '#ffffff', '--panel2': '#F8F9FA', '--surface': '#ffffff',
  '--line': 'rgba(0,0,0,0.10)', '--text': '#111827', '--muted': '#6B7280',
  ...SHARED_ACCENT, ...SEMANTIC, ...SHARED_SURFACES,
};

export const THEMES: Theme[] = [
  {
    id: 'concrete-gold',
    name: 'Concrete Gold',
    tagline: 'Light · day',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: SHARED_TOKENS,
  },
  {
    id: 'infra-green',
    name: 'Infra Green',
    tagline: 'Light · night',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: SHARED_TOKENS,
  },
];

// Legacy id aliases — old ids are silently remapped on load.
const LEGACY_ID_MAP: Record<string, string> = {
  day: 'concrete-gold',
  night: 'infra-green',
  'trust-blue': 'concrete-gold', // trust-blue removed; fall back to concrete-gold
};

const FONT_URLS: Record<string, string> = {
  Inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap',
};

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.tokens)) root.style.setProperty(k, v);
  root.style.setProperty('--font-app', theme.font);
  // Sync the native color-scheme so the browser/WebView renders scrollbars,
  // inputs and status-bar contrast correctly.
  // Both themes use a light background; always signal light to the WebView/browser.
  root.style.colorScheme = 'light';
}

export function loadThemeFont(fontName: string) {
  if (typeof document === 'undefined') return;
  const url = FONT_URLS[fontName];
  if (!url) return;
  let link = document.getElementById('gf-theme-font') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'gf-theme-font';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== url) link.href = url;
}

/* ===== Sunrise / sunset (all computed locally — nothing leaves the device).
   Uses the classic NOAA approximation. If the user has a remembered location
   from the Nearby screen (already stored locally by that feature), we use it
   for accurate local sun times; otherwise we fall back to 06:15 / 18:30. ===== */

/** Coord storage key used by the theme system (separate from nearby-screen cache). */
export const THEME_GEO_KEY = 'rmc-theme-geo';

function readStoredCoords(): { lat: number; lng: number } | null {
  // Check theme-specific geo key first (set by ThemeProvider on geolocation grant),
  // then fall back to the nearby-screen cache if present.
  for (const key of [THEME_GEO_KEY, 'rmc_nearby_location']) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number'
        && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)
        && Math.abs(parsed.lat) <= 90 && Math.abs(parsed.lng) <= 180) {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    } catch { /* ignore */ }
  }
  return null;
}

/** NOAA-style sunrise/sunset for a date + coords, returned as local Dates. Null in polar edge cases. */
export function sunTimes(date: Date, lat: number, lng: number): { sunrise: Date; sunset: Date } | null {
  const rad = Math.PI / 180;
  const dayOfYear = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 86400000);
  const compute = (isSunrise: boolean): { ut: number; dayOffset: number } | null => {
    const lngHour = lng / 15;
    const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
    L = ((L % 360) + 360) % 360;
    let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
    RA = ((RA % 360) + 360) % 360;
    RA += (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90);
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(L * rad);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
    if (cosH > 1 || cosH < -1) return null;
    let H = isSunrise ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad;
    H /= 15;
    const T = H + RA - 0.06571 * t - 6.622;
    const rawUT = T - lngHour;
    const dayOffset = Math.floor(rawUT / 24);
    const ut = rawUT - dayOffset * 24;
    return { ut, dayOffset };
  };
  const rise = compute(true);
  const set = compute(false);
  if (rise == null || set == null) return null;
  const toLocal = ({ ut, dayOffset }: { ut: number; dayOffset: number }) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setTime(d.getTime() + (dayOffset * 24 + ut) * 3600000);
    return d;
  };
  return { sunrise: toLocal(rise), sunset: toLocal(set) };
}

/** True when the clock says it's night (after sunset / before sunrise). */
export function isNightNow(now: Date = new Date()): boolean {
  const coords = readStoredCoords();
  if (coords) {
    const times = sunTimes(now, coords.lat, coords.lng);
    if (times) return now < times.sunrise || now >= times.sunset;
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins < 6 * 60 + 15 || mins >= 18 * 60 + 30;
}

// ─── User theme preference ────────────────────────────────────────────────────
// 'auto' = follow the clock (default, backward-compatible).
// A theme id = the user's explicit choice, persisted across sessions.
const PREF_KEY = 'rmc-theme-pref-v2';
const LEGACY_MODE_KEY = 'rmc-theme-mode-v1';
const LEGACY_THEME_KEY = 'rmc-theme-v2';

// The app is always automatic — Concrete Gold by day, Infra Green by night,
// following real sunrise/sunset with no in-app override. Any theme pinned by
// an older app version (back when a manual picker existed) is cleared here so
// upgrading users snap back to auto too.
export function readThemePreference(): ThemeMode {
  try { localStorage.removeItem(PREF_KEY); } catch { /* ignore */ }
  return 'auto';
}

export function writeThemePreference(mode: ThemeMode) {
  void mode;
  try { localStorage.removeItem(PREF_KEY); } catch { /* ignore */ }
}

export function resolveTheme(mode: ThemeMode, now: Date = new Date()): Theme {
  let id: string;
  if (mode === 'auto') {
    id = isNightNow(now) ? 'infra-green' : 'concrete-gold';
  } else {
    id = LEGACY_ID_MAP[mode] ?? mode;
  }
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

// Remove legacy storage keys from older app builds.
try {
  localStorage.removeItem(LEGACY_MODE_KEY);
  localStorage.removeItem(LEGACY_THEME_KEY);
} catch { /* ignore */ }

// Read the user preference (or 'auto') and apply synchronously at module load
// so there is no theme flash before React mounts.
export const initialPreference = readThemePreference();
export const initialTheme = resolveTheme(initialPreference);
applyTheme(initialTheme);

export interface ThemeCtx {
  theme: Theme;
  themes: Theme[];
  preference: ThemeMode;           // 'auto' or the user's explicit choice
  setPreference: (m: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeCtx>({
  theme: THEMES[0],
  themes: THEMES,
  preference: 'auto',
  setPreference: () => undefined,
});

export function useTheme() {
  return useContext(ThemeContext);
}
