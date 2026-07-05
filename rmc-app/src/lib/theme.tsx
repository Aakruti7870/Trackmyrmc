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

/* NIGHT chrome kit — glassmorphism on deep teal-black (glowing, cinematic). */
const NIGHT_SURFACES = {
  '--shadow-rgb': '0,0,0',
  '--glass-1': 'color-mix(in srgb, var(--surface) 78%, transparent)',
  '--glass-2': 'color-mix(in srgb, var(--bg-deep) 82%, transparent)',
  '--glass-border': 'rgba(0,201,167,0.15)',
  '--glass-hi': 'rgba(255,255,255,.05)',
  '--glass-blur': 'blur(24px) saturate(115%)',
  '--sidebar-1': 'rgba(8,20,22,.97)',
  '--sidebar-2': 'rgba(4,11,13,.97)',
  '--header-bg': 'rgba(5,12,14,.86)',
  '--menu-bg': 'rgba(10,24,26,.98)',
  '--menu-hover': 'rgba(0,201,167,.12)',
  '--overlay': 'rgba(2,7,8,.66)',
  '--chip-bg': 'rgba(0,201,167,.06)',
  '--sheen': 'rgba(255,255,255,.03)',
};

/* DAY chrome kit — crisp frosted-white glass with soft teal-tinted shadows. */
const DAY_SURFACES = {
  '--shadow-rgb': '18,54,48',
  '--glass-1': 'color-mix(in srgb, #ffffff 92%, transparent)',
  '--glass-2': 'color-mix(in srgb, #ffffff 74%, transparent)',
  '--glass-border': 'rgba(18,54,48,0.10)',
  '--glass-hi': 'rgba(255,255,255,.75)',
  '--glass-blur': 'blur(18px) saturate(135%)',
  '--sidebar-1': 'rgba(255,255,255,.94)',
  '--sidebar-2': 'rgba(236,244,242,.94)',
  '--header-bg': 'rgba(255,255,255,.82)',
  '--menu-bg': 'rgba(255,255,255,.99)',
  '--menu-hover': 'rgba(9,150,124,.10)',
  '--overlay': 'rgba(16,38,34,.32)',
  '--chip-bg': 'rgba(9,150,124,.08)',
  '--sheen': 'rgba(255,255,255,.45)',
};

/* Accent ramps (legacy --gold* key names). Night runs a bright teal that glows on
   black; Day runs a deeper teal so text/borders keep AA contrast on white. */
const NIGHT_ACCENT = {
  '--gold-hi': '#3fe3c5', '--gold-mid': '#12d6b0', '--gold': '#00C9A7', '--gold-dark': '#00a488',
  '--glow-1': 'rgba(0,201,167,.20)', '--glow-2': 'rgba(0,201,167,.07)',
};
const DAY_ACCENT = {
  '--gold-hi': '#0fb894', '--gold-mid': '#0aa585', '--gold': '#09967c', '--gold-dark': '#077763',
  '--glow-1': 'rgba(9,150,124,.16)', '--glow-2': 'rgba(9,150,124,.06)',
};

export const THEMES: Theme[] = [
  /* ===== Night — deep teal-black glass (DEFAULT) ===== */
  {
    id: 'night',
    name: 'Night',
    tagline: 'Dark · teal glass',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#0c1a1e', '--bg': '#06110F', '--bg-deep': '#030b0c',
      '--panel': '#0b1c1f', '--panel2': '#102428', '--surface': '#163034', '--line': 'rgba(0,201,167,0.16)',
      '--text': '#EBF4F1', '--muted': '#8aa29d',
      ...NIGHT_ACCENT,
      ...SEMANTIC,
      ...NIGHT_SURFACES,
    },
  },
  /* ===== Day — professional frosted-white with teal accent ===== */
  {
    id: 'day',
    name: 'Day',
    tagline: 'Light · frosted white',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#f8fbfa', '--bg': '#eef4f2', '--bg-deep': '#dfeae7',
      '--panel': '#ffffff', '--panel2': '#f3f8f7', '--surface': '#ffffff', '--line': 'rgba(16,50,45,0.11)',
      '--text': '#0e2b26', '--muted': '#5a706b',
      ...DAY_ACCENT,
      ...SEMANTIC,
      ...DAY_SURFACES,
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
