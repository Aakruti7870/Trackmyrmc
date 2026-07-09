import { createContext, useContext } from 'react';

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  fontName: string;
  font: string;
  tokens: Record<string, string>;
}

/** Theme mode: the app ALWAYS follows the clock (sunrise/sunset). There is no
    user-facing picker — 'day'/'night' remain only as resolve targets. */
export type ThemeMode = 'auto' | 'day' | 'night';

/* Semantic colors stay stable across both modes so status meaning never shifts. */
const SEMANTIC = {
  '--green': '#22c55e',
  '--green-dark': '#15803d',
  '--blue': '#38bdf8',
  '--red': '#ef4444',
  '--orange': '#f59e0b',
};

/* ===== Day — the ONE universal theme (kept exactly as the approved design):
   flat white cards on a cool mint-white page, teal accent, Inter type.
   No glass blur, no glows — clean and easy to read like a delivery app. ===== */
const DAY_SURFACES = {
  '--shadow-rgb': '18,33,29',
  '--glass-1': '#ffffff',
  '--glass-2': '#ffffff',
  '--glass-border': 'rgba(18,33,29,0.10)',
  '--glass-hi': 'transparent',
  '--glass-blur': 'none',
  '--sidebar-1': '#ffffff',
  '--sidebar-2': '#ffffff',
  '--header-bg': 'rgba(255,255,255,.92)',
  '--menu-bg': '#ffffff',
  '--menu-hover': 'rgba(23,138,110,.08)',
  '--overlay': 'rgba(18,33,29,.32)',
  '--chip-bg': '#f0f9f6',
  '--sheen': 'transparent',
};

/* Teal accent ramp (legacy --gold* key names — referenced app-wide, don't rename).
   Tuned for AA contrast on white. Soft tints back the mobile delivery chrome. */
const DAY_ACCENT = {
  '--gold-hi': '#1a9678', '--gold-mid': '#178a6e', '--gold': '#178a6e', '--gold-dark': '#0f766e',
  '--glow-1': 'rgba(23,138,110,.16)', '--glow-2': 'transparent',
  '--gold-soft': '#e6f4ef', '--gold-tint': '#f0f9f6',
  '--prompt-bg': '#eef8f4', '--prompt-border': 'rgba(23,138,110,0.18)', '--prompt-icon-bg': '#d7ece4',
};

/* ===== Night — the standard dark counterpart of the SAME design language:
   deep green-ink surfaces, light text, a slightly brighter teal so the accent
   keeps AA contrast on dark. Layout, spacing and components are unchanged —
   only the token values flip. ===== */
const NIGHT_SURFACES = {
  '--shadow-rgb': '0,0,0',
  '--glass-1': '#13221d',
  '--glass-2': '#101d18',
  '--glass-border': 'rgba(234,244,240,0.09)',
  '--glass-hi': 'transparent',
  '--glass-blur': 'none',
  '--sidebar-1': '#101d18',
  '--sidebar-2': '#0e1a16',
  '--header-bg': 'rgba(12,23,19,.92)',
  '--menu-bg': '#13221d',
  '--menu-hover': 'rgba(39,181,140,.12)',
  '--overlay': 'rgba(0,0,0,.55)',
  '--chip-bg': '#16261f',
  '--sheen': 'transparent',
};

const NIGHT_ACCENT = {
  '--gold-hi': '#33c39a', '--gold-mid': '#27b58c', '--gold': '#27b58c', '--gold-dark': '#1d9573',
  '--glow-1': 'rgba(39,181,140,.22)', '--glow-2': 'transparent',
  '--gold-soft': '#14352b', '--gold-tint': '#102a22',
  '--prompt-bg': '#0f2620', '--prompt-border': 'rgba(39,181,140,0.28)', '--prompt-icon-bg': '#14352b',
};

export const THEMES: Theme[] = [
  {
    id: 'day',
    name: 'Day',
    tagline: 'Light · flat',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#f7faf8', '--bg': '#f4f7f5', '--bg-deep': '#e9f0ed',
      '--panel': '#ffffff', '--panel2': '#f7faf8', '--surface': '#ffffff', '--line': 'rgba(18,33,29,0.10)',
      '--text': '#12211d', '--muted': '#6b7c76',
      ...DAY_ACCENT,
      ...SEMANTIC,
      ...DAY_SURFACES,
    },
  },
  {
    id: 'night',
    name: 'Night',
    tagline: 'Dark · flat',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#10201b', '--bg': '#0c1713', '--bg-deep': '#091210',
      '--panel': '#12211d', '--panel2': '#0f1c18', '--surface': '#12211d', '--line': 'rgba(234,244,240,0.10)',
      '--text': '#eaf4f0', '--muted': '#9db3ab',
      ...NIGHT_ACCENT,
      ...SEMANTIC,
      ...NIGHT_SURFACES,
    },
  },
];

const MODE_STORAGE_KEY = 'rmc-theme-mode-v1';
const LEGACY_STORAGE_KEY = 'rmc-theme-v2';

const FONT_URLS: Record<string, string> = {
  'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap',
};

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.tokens)) root.style.setProperty(k, v);
  root.style.setProperty('--font-app', theme.font);
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
    if (cosH > 1 || cosH < -1) return null; // sun never rises/sets here today
    let H = isSunrise ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad;
    H /= 15;
    const T = H + RA - 0.06571 * t - 6.622;
    const rawUT = T - lngHour;
    // Preserve the day rollover instead of just wrapping, so events near the
    // UTC date boundary (extreme longitudes) land on the correct calendar day.
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
  // Fallback when no location is known: 06:15 sunrise / 18:30 sunset local time.
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins < 6 * 60 + 15 || mins >= 18 * 60 + 30;
}

export function resolveTheme(mode: ThemeMode, now: Date = new Date()): Theme {
  const id = mode === 'auto' ? (isNightNow(now) ? 'night' : 'day') : mode;
  return THEMES.find(t => t.id === id) || THEMES[0];
}

/* The theme mode is permanently 'auto' — clean up any previously stored
   manual choice from the era when a picker existed. */
try {
  localStorage.removeItem(MODE_STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
} catch { /* ignore */ }

/* Apply synchronously at module load so there is no theme flash before React mounts. */
export const initialTheme = resolveTheme('auto');
applyTheme(initialTheme);

export interface ThemeCtx {
  theme: Theme;          // the effective (currently applied) theme
  themes: Theme[];
}

export const ThemeContext = createContext<ThemeCtx>({
  theme: THEMES[0],
  themes: THEMES,
});

export function useTheme() {
  return useContext(ThemeContext);
}
