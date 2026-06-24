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

/* Night (deep teal) chrome kit — sidebar/header/menus/overlay/glass. */
const NIGHT_SURFACES = {
  '--shadow-rgb': '0,0,0',
  '--glass-1': 'color-mix(in srgb, var(--surface) 92%, transparent)',
  '--glass-2': 'color-mix(in srgb, var(--bg-deep) 96%, transparent)',
  '--glass-border': 'rgba(160,210,198,.16)',
  '--glass-hi': 'rgba(255,255,255,.06)',
  '--glass-blur': 'blur(2px)',
  '--sidebar-1': 'rgba(10,34,30,.97)',
  '--sidebar-2': 'rgba(6,21,17,.97)',
  '--header-bg': 'rgba(10,34,30,.96)',
  '--menu-bg': 'rgba(14,42,37,.96)',
  '--menu-hover': 'rgba(43,181,149,.12)',
  '--overlay': 'rgba(4,14,11,.6)',
  '--chip-bg': 'rgba(255,255,255,.04)',
  '--sheen': 'rgba(255,255,255,.04)',
};

/* King (black & metallic gold) chrome kit — premium dark with gold-tinted edges. */
const KING_SURFACES = {
  '--shadow-rgb': '0,0,0',
  '--glass-1': 'color-mix(in srgb, var(--surface) 90%, transparent)',
  '--glass-2': 'color-mix(in srgb, var(--bg-deep) 94%, transparent)',
  '--glass-border': 'rgba(212,175,55,.20)',
  '--glass-hi': 'rgba(255,255,255,.05)',
  '--glass-blur': 'blur(3px)',
  '--sidebar-1': 'rgba(12,15,22,.98)',
  '--sidebar-2': 'rgba(6,8,13,.98)',
  '--header-bg': 'rgba(10,13,19,.97)',
  '--menu-bg': 'rgba(16,20,29,.98)',
  '--menu-hover': 'rgba(212,175,55,.12)',
  '--overlay': 'rgba(2,3,6,.68)',
  '--chip-bg': 'rgba(212,175,55,.07)',
  '--sheen': 'rgba(255,255,255,.04)',
};

/* Day (white & teal) chrome kit. */
const DAY_SURFACES = {
  '--shadow-rgb': '18,64,58',
  '--glass-1': 'rgba(255,255,255,0.82)',
  '--glass-2': 'rgba(255,255,255,0.6)',
  '--glass-border': 'rgba(255,255,255,0.9)',
  '--glass-hi': 'rgba(255,255,255,0.92)',
  '--glass-blur': 'blur(20px) saturate(140%)',
  '--sidebar-1': 'rgba(255,255,255,0.9)',
  '--sidebar-2': 'rgba(244,248,247,0.84)',
  '--header-bg': 'rgba(255,255,255,0.92)',
  '--menu-bg': 'rgba(255,255,255,0.97)',
  '--menu-hover': 'rgba(18,64,58,0.06)',
  '--overlay': 'rgba(10,30,26,0.35)',
  '--chip-bg': 'rgba(18,64,58,0.04)',
  '--sheen': 'rgba(255,255,255,.5)',
};

export const THEMES: Theme[] = [
  /* ===== King — black & metallic gold (DEFAULT) ===== */
  {
    id: 'king',
    name: 'King',
    tagline: 'Premium · black & gold',
    fontName: 'Sora',
    font: "'Sora', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#0e131c', '--bg': '#090d14', '--bg-deep': '#05080d',
      '--panel': '#10151f', '--panel2': '#141b27', '--surface': '#161d2a', '--line': 'rgba(212,175,55,0.16)',
      '--text': '#f4efe2', '--muted': '#94a0b0',
      '--gold-hi': '#f3d87a', '--gold-mid': '#e0b84b', '--gold': '#d4af37', '--gold-dark': '#a9821a',
      '--glow-1': 'rgba(212,175,55,.22)', '--glow-2': 'rgba(212,175,55,.08)',
      ...SEMANTIC,
      ...KING_SURFACES,
    },
  },
  /* ===== Day — clean white & teal ===== */
  {
    id: 'day',
    name: 'Day',
    tagline: 'Light · white & teal',
    fontName: 'Sora',
    font: "'Sora', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#ffffff', '--bg': '#f3f7f6', '--bg-deep': '#e6eeeb',
      '--panel': '#ffffff', '--panel2': '#f4f8f7', '--surface': '#ffffff', '--line': 'rgba(18,64,58,0.12)',
      '--text': '#0f2e29', '--muted': '#5b716c',
      '--gold-hi': '#3fc7a4', '--gold-mid': '#1f9e80', '--gold': '#178a6e', '--gold-dark': '#0f6e57',
      '--glow-1': 'rgba(23,138,110,.14)', '--glow-2': 'rgba(18,64,58,.10)',
      ...SEMANTIC,
      /* status hues retuned for legibility on a light surface */
      '--green': '#15a06a', '--green-dark': '#0f7a4f', '--blue': '#2a83d6',
      '--red': '#e11d48', '--orange': '#d97706',
      ...DAY_SURFACES,
    },
  },
  /* ===== Night — deep teal & emerald ===== */
  {
    id: 'night',
    name: 'Night',
    tagline: 'Dark · deep teal',
    fontName: 'Sora',
    font: "'Sora', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#103e37', '--bg': '#0a221e', '--bg-deep': '#061511',
      '--panel': '#0e2a25', '--panel2': '#12352e', '--surface': '#163f37', '--line': 'rgba(255,255,255,0.10)',
      '--text': '#eaf6f1', '--muted': '#9fc2b8',
      '--gold-hi': '#46d6b0', '--gold-mid': '#2bb595', '--gold': '#1f9e80', '--gold-dark': '#147a62',
      '--glow-1': 'rgba(43,181,149,.18)', '--glow-2': 'rgba(20,122,98,.10)',
      ...SEMANTIC,
      ...NIGHT_SURFACES,
    },
  },
];

const STORAGE_KEY = 'rmc-theme-v2';

const FONT_URLS: Record<string, string> = {
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
