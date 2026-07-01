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

/* Cinematic teal chrome kit — glassmorphism on deep teal-black.
   Shared by every variant so the whole app keeps one dark, glowing look. */
const CINEMATIC_SURFACES = {
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

/* Teal accent ramp shared across every variant (legacy --gold* key names). */
const TEAL_ACCENT = {
  '--gold-hi': '#3fe3c5', '--gold-mid': '#12d6b0', '--gold': '#00C9A7', '--gold-dark': '#00a488',
  '--glow-1': 'rgba(0,201,167,.20)', '--glow-2': 'rgba(0,201,167,.07)',
};

export const THEMES: Theme[] = [
  /* ===== Cinematic — deep teal-black glass (DEFAULT) ===== */
  {
    id: 'king',
    name: 'Cinematic',
    tagline: 'Dark · teal glass',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#0a1417', '--bg': '#050A0C', '--bg-deep': '#02070A',
      '--panel': '#0a1618', '--panel2': '#0d1d20', '--surface': '#112427', '--line': 'rgba(0,201,167,0.15)',
      '--text': '#E8F0EE', '--muted': '#7A8F8D',
      ...TEAL_ACCENT,
      ...SEMANTIC,
      ...CINEMATIC_SURFACES,
    },
  },
  /* ===== Obsidian — near-black teal ===== */
  {
    id: 'night',
    name: 'Obsidian',
    tagline: 'Darker · near-black',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#050d0f', '--bg': '#02070A', '--bg-deep': '#010405',
      '--panel': '#071113', '--panel2': '#0a181b', '--surface': '#0d1f22', '--line': 'rgba(0,201,167,0.13)',
      '--text': '#E8F0EE', '--muted': '#6f8482',
      ...TEAL_ACCENT,
      ...SEMANTIC,
      ...CINEMATIC_SURFACES,
    },
  },
  /* ===== Steel — lighter charcoal-teal (still fully dark, no white) ===== */
  {
    id: 'day',
    name: 'Steel',
    tagline: 'Lighter · charcoal teal',
    fontName: 'Inter',
    font: "'Inter', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#122327', '--bg': '#0d1c1f', '--bg-deep': '#081416',
      '--panel': '#132528', '--panel2': '#173035', '--surface': '#1b393e', '--line': 'rgba(0,201,167,0.18)',
      '--text': '#EAF3F1', '--muted': '#8ba39f',
      ...TEAL_ACCENT,
      ...SEMANTIC,
      ...CINEMATIC_SURFACES,
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
