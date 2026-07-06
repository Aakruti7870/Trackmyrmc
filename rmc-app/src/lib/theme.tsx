import { createContext, useContext } from 'react';

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  fontName: string;
  font: string;
  tokens: Record<string, string>;
}

/* Semantic colors stay stable across both modes so status meaning never shifts. */
const SEMANTIC = {
  '--green': '#22c55e',
  '--green-dark': '#15803d',
  '--blue': '#38bdf8',
  '--red': '#ef4444',
  '--orange': '#f59e0b',
};

/* One simple FLAT chrome kit — solid warm-white surfaces, no glass blur, no
   glows, soft hairline borders. This is the single app-wide look: clean and
   easy to read like a delivery app, with the same warm palette as the login. */
const FLAT_SURFACES = {
  '--shadow-rgb': '28,25,23',
  '--glass-1': '#ffffff',
  '--glass-2': '#ffffff',
  '--glass-border': 'rgba(28,25,23,0.10)',
  '--glass-hi': 'transparent',
  '--glass-blur': 'none',
  '--sidebar-1': '#ffffff',
  '--sidebar-2': '#ffffff',
  '--header-bg': 'rgba(255,255,255,.92)',
  '--menu-bg': '#ffffff',
  '--menu-hover': 'rgba(15,118,110,.08)',
  '--overlay': 'rgba(28,25,23,.32)',
  '--chip-bg': '#f4efe7',
  '--sheen': 'transparent',
};

/* Teal accent ramp (legacy --gold* key names). Kept close together so any
   gradient built from these stops renders essentially flat. Tuned for AA
   contrast on white. */
const FLAT_ACCENT = {
  '--gold-hi': '#12876f', '--gold-mid': '#0f766e', '--gold': '#0f766e', '--gold-dark': '#0d6560',
  '--glow-1': 'rgba(15,118,110,.16)', '--glow-2': 'transparent',
};

export const THEMES: Theme[] = [
  /* ===== Simple — one flat warm-white theme (the whole app uses this) ===== */
  {
    id: 'day',
    name: 'Simple',
    tagline: 'Light · flat',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#fdfbf7', '--bg': '#fdfbf7', '--bg-deep': '#f4efe7',
      '--panel': '#ffffff', '--panel2': '#faf7f2', '--surface': '#ffffff', '--line': 'rgba(28,25,23,0.10)',
      '--text': '#1c1917', '--muted': '#78716c',
      ...FLAT_ACCENT,
      ...SEMANTIC,
      ...FLAT_SURFACES,
    },
  },
];

const STORAGE_KEY = 'rmc-theme-v2';

const FONT_URLS: Record<string, string> = {
  'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap',
  'Sora': 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap',
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

function readStored(): Theme {
  let id: string | null = null;
  try { id = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  return THEMES.find(t => t.id === id) || THEMES[0];
}

export function persistTheme(theme: Theme) {
  try { localStorage.setItem(STORAGE_KEY, theme.id); } catch { /* ignore */ }
}

/* Apply synchronously at module load so there is no theme flash before React mounts. */
export const initialTheme = readStored();
applyTheme(initialTheme);

export interface ThemeCtx {
  theme: Theme;
  themes: Theme[];
  setTheme: (id: string) => void;
}

export const ThemeContext = createContext<ThemeCtx>({
  theme: THEMES[0],
  themes: THEMES,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
