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
export type ThemeMode = 'auto' | 'concrete-gold' | 'trust-blue' | 'infra-green';

/* Semantic colors stay stable across all themes so status meaning never shifts. */
const SEMANTIC = {
  '--green': '#22c55e',
  '--green-dark': '#15803d',
  '--blue': '#38bdf8',
  '--red': '#B94040',   // approved controlled error red
  '--orange': '#f59e0b',
};

// ─── Theme 1: Concrete Gold (Day / Light) ────────────────────────────────────
// Flat white cards on a cool mint-white page, deep teal accent, Inter type.
const CG_SURFACES = {
  '--shadow-rgb': '18,33,29',
  '--glass-1': '#ffffff', '--glass-2': '#ffffff',
  '--glass-border': 'rgba(23,138,110,0.14)', '--glass-hi': 'transparent', '--glass-blur': 'none',
  '--sidebar-1': '#ffffff', '--sidebar-2': '#F3F7F5',
  '--header-bg': 'rgba(255,255,255,.94)', '--menu-bg': '#ffffff',
  '--menu-hover': 'rgba(23,138,110,.08)', '--overlay': 'rgba(18,33,29,.32)',
  '--chip-bg': '#E3F3EE', '--sheen': 'transparent',
};
const CG_ACCENT = {
  '--gold-hi': '#1FA882', '--gold-mid': '#178A6E', '--gold': '#178A6E', '--gold-dark': '#0E6650',
  '--glow-1': 'rgba(23,138,110,.16)', '--glow-2': 'transparent',
  '--gold-soft': '#E0F5EF', '--gold-tint': '#EFF9F6',
  '--prompt-bg': '#E8F7F2', '--prompt-border': 'rgba(23,138,110,0.18)', '--prompt-icon-bg': '#B8E6D8',
};

// ─── Theme 2: Trust Blue (Light, confidence-first) ───────────────────────────
// Clean white cards on a very light blue-grey page, strong blue accent.
// Designed for customers who want a more "banking / trusted service" feel.
const TB_SURFACES = {
  '--shadow-rgb': '15,23,42',
  '--glass-1': '#ffffff', '--glass-2': '#f8faff',
  '--glass-border': 'rgba(15,23,42,0.10)', '--glass-hi': 'transparent', '--glass-blur': 'none',
  '--sidebar-1': '#ffffff', '--sidebar-2': '#f8faff',
  '--header-bg': 'rgba(255,255,255,.94)', '--menu-bg': '#ffffff',
  '--menu-hover': 'rgba(37,99,235,.07)', '--overlay': 'rgba(15,23,42,.32)',
  '--chip-bg': '#eff6ff', '--sheen': 'transparent',
};
const TB_ACCENT = {
  '--gold-hi': '#3b82f6', '--gold-mid': '#2563eb', '--gold': '#2563eb', '--gold-dark': '#1d4ed8',
  '--glow-1': 'rgba(37,99,235,.14)', '--glow-2': 'transparent',
  '--gold-soft': '#dbeafe', '--gold-tint': '#eff6ff',
  '--prompt-bg': '#eff6ff', '--prompt-border': 'rgba(37,99,235,0.18)', '--prompt-icon-bg': '#bfdbfe',
};

// ─── Theme 3: Infra Green (Night / Dark) ─────────────────────────────────────
// Deep green-ink surfaces, light text, brighter teal accent for AA contrast.
const IG_SURFACES = {
  '--shadow-rgb': '0,0,0',
  '--glass-1': '#121f1b', '--glass-2': '#0e1916',
  '--glass-border': 'rgba(39,181,140,0.14)', '--glass-hi': 'transparent', '--glass-blur': 'none',
  '--sidebar-1': '#101c18', '--sidebar-2': '#0C1713',
  '--header-bg': 'rgba(11,19,16,.96)', '--menu-bg': '#121f1b',
  '--menu-hover': 'rgba(39,181,140,.10)', '--overlay': 'rgba(0,0,0,.62)',
  '--chip-bg': '#132920', '--sheen': 'transparent',
};
const IG_ACCENT = {
  '--gold-hi': '#34D19E', '--gold-mid': '#27B58C', '--gold': '#27B58C', '--gold-dark': '#1FA882',
  '--glow-1': 'rgba(39,181,140,.22)', '--glow-2': 'transparent',
  '--gold-soft': '#0D2A22', '--gold-tint': '#091E18',
  '--prompt-bg': '#0F2F26', '--prompt-border': 'rgba(39,181,140,0.28)', '--prompt-icon-bg': '#1A4A3A',
};

export const THEMES: Theme[] = [
  {
    id: 'concrete-gold',
    name: 'Concrete Gold',
    tagline: 'Light · teal',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#F4F7F5', '--bg': '#F1F5F3', '--bg-deep': '#E3EBE7',
      '--panel': '#ffffff', '--panel2': '#F3F7F5', '--surface': '#ffffff',
      '--line': 'rgba(23,138,110,0.14)', '--text': '#12211D', '--muted': '#6B7C76',
      ...CG_ACCENT, ...SEMANTIC, ...CG_SURFACES,
    },
  },
  {
    id: 'trust-blue',
    name: 'Trust Blue',
    tagline: 'Light · blue',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#f0f7ff', '--bg': '#f0f4fa', '--bg-deep': '#e1eaf7',
      '--panel': '#ffffff', '--panel2': '#f8faff', '--surface': '#ffffff',
      '--line': 'rgba(15,23,42,0.10)', '--text': '#0f172a', '--muted': '#64748b',
      ...TB_ACCENT, ...SEMANTIC, ...TB_SURFACES,
    },
  },
  {
    id: 'infra-green',
    name: 'Infra Green',
    tagline: 'Dark · night',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#0F1B17', '--bg': '#0C1713', '--bg-deep': '#091410',
      '--panel': '#121f1b', '--panel2': '#0e1916', '--surface': '#121f1b',
      '--line': 'rgba(39,181,140,0.14)', '--text': '#EAF4F0', '--muted': '#7BA898',
      ...IG_ACCENT, ...SEMANTIC, ...IG_SURFACES,
    },
  },
];

// Legacy id aliases — 'day' → 'concrete-gold', 'night' → 'infra-green'.
// Stored preferences written by older builds are silently remapped.
const LEGACY_ID_MAP: Record<string, string> = { day: 'concrete-gold', night: 'infra-green' };

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
  root.style.colorScheme = theme.id === 'infra-green' ? 'dark' : 'light';
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

export function readThemePreference(): ThemeMode {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return 'auto';
    const mapped = LEGACY_ID_MAP[raw] ?? raw;
    if (mapped === 'auto' || THEMES.some(t => t.id === mapped)) return mapped as ThemeMode;
  } catch { /* ignore */ }
  return 'auto';
}

export function writeThemePreference(mode: ThemeMode) {
  try {
    if (mode === 'auto') {
      localStorage.removeItem(PREF_KEY);
    } else {
      localStorage.setItem(PREF_KEY, mode);
    }
  } catch { /* ignore */ }
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
