import { createContext, useContext } from 'react';

export interface Theme {
  id: string;
  name: string;
  tagline: string;
  fontName: string;
  font: string;
  tokens: Record<string, string>;
}

/* Semantic colors stay stable across every theme so status meaning never shifts. */
const SEMANTIC = {
  '--green': '#22c55e',
  '--green-dark': '#15803d',
  '--blue': '#38bdf8',
  '--red': '#ef4444',
  '--orange': '#f59e0b', /* command-center warning accent */
};

/* Surface "kits" — the dark-baked chrome (sidebar/header/menus/overlay/glass)
 * is tokenized so each theme can flip it. Every theme MUST carry a full kit,
 * otherwise applyTheme() leaves stale values from the previously-active theme. */
const DARK_SURFACES = {
  '--shadow-rgb': '0,0,0',
  '--glass-1': 'color-mix(in srgb, var(--surface) 92%, transparent)',
  '--glass-2': 'color-mix(in srgb, var(--bg-deep) 96%, transparent)',
  '--glass-border': 'rgba(203,213,225,.14)',
  '--glass-hi': 'rgba(255,255,255,.08)',
  '--glass-blur': 'blur(2px)',
  '--sidebar-1': 'rgba(8,17,31,.97)',
  '--sidebar-2': 'rgba(2,6,18,.97)',
  '--header-bg': 'rgba(8,17,31,.96)',
  '--menu-bg': 'rgba(13,25,48,.95)',
  '--menu-hover': 'rgba(38,52,73,.5)',
  '--overlay': 'rgba(5,9,20,.6)',
  '--chip-bg': 'rgba(255,255,255,.03)',
  '--sheen': 'rgba(255,255,255,.035)',
};

const LIGHT_SURFACES = {
  '--shadow-rgb': '30,41,90',
  '--glass-1': 'rgba(255,255,255,0.78)',
  '--glass-2': 'rgba(255,255,255,0.55)',
  '--glass-border': 'rgba(255,255,255,0.85)',
  '--glass-hi': 'rgba(255,255,255,0.9)',
  '--glass-blur': 'blur(20px) saturate(140%)',
  '--sidebar-1': 'rgba(255,255,255,0.88)',
  '--sidebar-2': 'rgba(245,248,253,0.82)',
  '--header-bg': 'rgba(255,255,255,0.9)',
  '--menu-bg': 'rgba(255,255,255,0.97)',
  '--menu-hover': 'rgba(30,41,90,0.06)',
  '--overlay': 'rgba(15,23,42,0.35)',
  '--chip-bg': 'rgba(30,41,90,0.04)',
  '--sheen': 'rgba(255,255,255,.5)',
};

export const THEMES: Theme[] = [
  /* ===== Daylight Glass — frosted light glassmorphism (DEFAULT) ===== */
  {
    id: 'daylight-glass',
    name: 'Daylight Glass',
    tagline: 'Frosted light & aurora gold',
    fontName: 'Sora',
    font: "'Sora', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#f4f7fc', '--bg': '#eef2f9', '--bg-deep': '#e3e9f4',
      '--panel': '#ffffff', '--panel2': '#f6f9fd', '--surface': '#ffffff', '--line': 'rgba(30,41,90,0.12)',
      '--text': '#0f172a', '--muted': '#5a6b85',
      '--gold-hi': '#f5b942', '--gold-mid': '#e59a16', '--gold': '#d68a0a', '--gold-dark': '#a96a06',
      '--glow-1': 'rgba(214,138,10,.16)', '--glow-2': 'rgba(14,154,167,.16)',
      ...SEMANTIC,
      /* status hues retuned for legibility on a light surface */
      '--green': '#15a06a', '--green-dark': '#0f7a4f', '--blue': '#2a83d6',
      '--red': '#e11d57', '--orange': '#d97706',
      ...LIGHT_SURFACES,
    },
  },
  /* ===== Concept 5: Futuristic 3D Command Center ===== */
  {
    id: 'command-center',
    name: 'Command Center',
    tagline: 'Matte black & electric gold',
    fontName: 'Sora',
    font: "'Sora', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#0b1118', '--bg': '#05070a', '--bg-deep': '#020305',
      '--panel': '#12181f', '--panel2': '#161d27', '--surface': '#1a232f', '--line': 'rgba(255,255,255,0.10)',
      '--text': '#f5f7fa', '--muted': '#9ca3af',
      '--gold-hi': '#f3dd86', '--gold-mid': '#e3c14e', '--gold': '#d4af37', '--gold-dark': '#a67c12',
      '--glow-1': 'rgba(212,175,55,.16)', '--glow-2': 'rgba(0,180,216,.14)',
      ...SEMANTIC,
      '--blue': '#00b4d8', /* electric blue is the command-center accent */
      ...DARK_SURFACES,
    },
  },
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    tagline: 'Deep navy & warm gold',
    fontName: 'Sora',
    font: "'Sora', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#1c2a44', '--bg': '#08111f', '--bg-deep': '#050914',
      '--panel': '#101b2e', '--panel2': '#162235', '--surface': '#1a2940', '--line': '#263449',
      '--text': '#eef5ff', '--muted': '#9fb0c7',
      '--gold-hi': '#ffe08a', '--gold-mid': '#f6b818', '--gold': '#f7c948', '--gold-dark': '#d97706',
      '--glow-1': 'rgba(255,183,3,.16)', '--glow-2': 'rgba(56,189,248,.10)',
      ...SEMANTIC,
      ...DARK_SURFACES,
    },
  },
  {
    id: 'royal-amethyst',
    name: 'Royal Amethyst',
    tagline: 'Indigo night & violet',
    fontName: 'Plus Jakarta Sans',
    font: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#2a1f4a', '--bg': '#0d0a1f', '--bg-deep': '#070514',
      '--panel': '#161033', '--panel2': '#1d1640', '--surface': '#241b4d', '--line': '#342a5e',
      '--text': '#efeaff', '--muted': '#b3a8cf',
      '--gold-hi': '#e9d5ff', '--gold-mid': '#c4a0ff', '--gold': '#b794f6', '--gold-dark': '#7c3aed',
      '--glow-1': 'rgba(167,139,250,.20)', '--glow-2': 'rgba(56,189,248,.10)',
      ...SEMANTIC,
      ...DARK_SURFACES,
    },
  },
  {
    id: 'copper-dusk',
    name: 'Copper Dusk',
    tagline: 'Warm charcoal & copper',
    fontName: 'Space Grotesk',
    font: "'Space Grotesk', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#2e2118', '--bg': '#14100c', '--bg-deep': '#0c0907',
      '--panel': '#1c1611', '--panel2': '#241b14', '--surface': '#2c2118', '--line': '#3d2f23',
      '--text': '#fdf4ea', '--muted': '#c9b6a3',
      '--gold-hi': '#ffd9a8', '--gold-mid': '#f0a857', '--gold': '#e8923c', '--gold-dark': '#b45309',
      '--glow-1': 'rgba(232,146,60,.20)', '--glow-2': 'rgba(220,140,80,.10)',
      ...SEMANTIC,
      ...DARK_SURFACES,
    },
  },
  {
    id: 'rose-noir',
    name: 'Rose Noir',
    tagline: 'Dark plum & rose gold',
    fontName: 'Manrope',
    font: "'Manrope', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#3a1f2e', '--bg': '#160d14', '--bg-deep': '#0d070b',
      '--panel': '#1f131b', '--panel2': '#281822', '--surface': '#311e2a', '--line': '#432a3a',
      '--text': '#fdeef5', '--muted': '#cdb0bf',
      '--gold-hi': '#ffd5e4', '--gold-mid': '#f7a8c4', '--gold': '#f084ac', '--gold-dark': '#be185d',
      '--glow-1': 'rgba(240,132,172,.18)', '--glow-2': 'rgba(167,139,250,.10)',
      ...SEMANTIC,
      ...DARK_SURFACES,
    },
  },
  {
    id: 'arctic-steel',
    name: 'Arctic Steel',
    tagline: 'Cool slate & ice cyan',
    fontName: 'Outfit',
    font: "'Outfit', system-ui, -apple-system, sans-serif",
    tokens: {
      '--bg-top': '#1b3047', '--bg': '#0a1622', '--bg-deep': '#050d15',
      '--panel': '#0f1e2c', '--panel2': '#152838', '--surface': '#1b3145', '--line': '#294056',
      '--text': '#ecf5fd', '--muted': '#9fb6c9',
      '--gold-hi': '#d0f0fa', '--gold-mid': '#7dd3ec', '--gold': '#56c5e0', '--gold-dark': '#0e7490',
      '--glow-1': 'rgba(86,197,224,.18)', '--glow-2': 'rgba(125,211,252,.10)',
      ...SEMANTIC,
      ...DARK_SURFACES,
    },
  },
];

const STORAGE_KEY = 'rmc-theme';

const FONT_URLS: Record<string, string> = {
  'Sora':             'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap',
  'Plus Jakarta Sans':'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  'Space Grotesk':    'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap',
  'Manrope':          'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
  'Outfit':           'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap',
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
