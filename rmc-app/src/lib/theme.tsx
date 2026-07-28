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
  '--red': '#ef4444',
  '--orange': '#f59e0b',
};

// ─── Theme 1: Concrete Gold (Day / Light) ────────────────────────────────────
// Flat white cards on a cool mint-white page, teal accent, Inter type.
const CG_SURFACES = {
  '--shadow-rgb': '18,33,29',
  '--glass-1': '#ffffff', '--glass-2': '#ffffff',
  '--glass-border': 'rgba(18,33,29,0.10)', '--glass-hi': 'transparent', '--glass-blur': 'none',
  '--sidebar-1': '#ffffff', '--sidebar-2': '#ffffff',
  '--header-bg': 'rgba(255,255,255,.92)', '--menu-bg': '#ffffff',
  '--menu-hover': 'rgba(23,138,110,.08)', '--overlay': 'rgba(18,33,29,.32)',
  '--chip-bg': '#f0f9f6', '--sheen': 'transparent',
};
const CG_ACCENT = {
  '--gold-hi': '#1a9678', '--gold-mid': '#178a6e', '--gold': '#178a6e', '--gold-dark': '#0f766e',
  '--glow-1': 'rgba(23,138,110,.16)', '--glow-2': 'transparent',
  '--gold-soft': '#e6f4ef', '--gold-tint': '#f0f9f6',
  '--prompt-bg': '#eef8f4', '--prompt-border': 'rgba(23,138,110,0.18)', '--prompt-icon-bg': '#d7ece4',
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
  '--glass-1': '#13221d', '--glass-2': '#101d18',
  '--glass-border': 'rgba(234,244,240,0.09)', '--glass-hi': 'transparent', '--glass-blur': 'none',
  '--sidebar-1': '#101d18', '--sidebar-2': '#0e1a16',
  '--header-bg': 'rgba(12,23,19,.92)', '--menu-bg': '#13221d',
  '--menu-hover': 'rgba(39,181,140,.12)', '--overlay': 'rgba(0,0,0,.55)',
  '--chip-bg': '#16261f', '--sheen': 'transparent',
};
const IG_ACCENT = {
  '--gold-hi': '#33c39a', '--gold-mid': '#27b58c', '--gold': '#27b58c', '--gold-dark': '#1d9573',
  '--glow-1': 'rgba(39,181,140,.22)', '--glow-2': 'transparent',
  '--gold-soft': '#14352b', '--gold-tint': '#102a22',
  '--prompt-bg': '#0f2620', '--prompt-border': 'rgba(39,181,140,0.28)', '--prompt-icon-bg': '#14352b',
};

export const THEMES: Theme[] = [
  {
    id: 'concrete-gold',
    name: 'Concrete Gold',
    tagline: 'Light · teal',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#f7faf8', '--bg': '#f4f7f5', '--bg-deep': '#e9f0ed',
      '--panel': '#ffffff', '--panel2': '#f7faf8', '--surface': '#ffffff',
      '--line': 'rgba(18,33,29,0.10)', '--text': '#12211d', '--muted': '#6b7c76',
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
      '--bg-top': '#10201b', '--bg': '#0c1713', '--bg-deep': '#091210',
      '--panel': '#12211d', '--panel2': '#0f1c18', '--surface': '#12211d',
      '--line': 'rgba(234,244,240,0.10)', '--text': '#eaf4f0', '--muted': '#9db3ab',
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

function readStoredCoords(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem('rmc_nearby_location');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number'
      && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)
      && Math.abs(parsed.lat) <= 90 && Math.abs(parsed.lng) <= 180) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch { /* ignore */ }
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
