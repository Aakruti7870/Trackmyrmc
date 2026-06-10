import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Check } from 'lucide-react';

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

export const THEMES: Theme[] = [
  /* ===== Concept 5: Futuristic 3D Command Center (default) ===== */
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
    },
  },
];

const STORAGE_KEY = 'rmc-theme';

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.tokens)) root.style.setProperty(k, v);
  root.style.setProperty('--font-app', theme.font);
}

function readStored(): Theme {
  let id: string | null = null;
  try { id = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
  return THEMES.find(t => t.id === id) || THEMES[0];
}

/* Apply synchronously at module load so there is no theme flash before React mounts. */
const initialTheme = readStored();
applyTheme(initialTheme);

interface ThemeCtx {
  theme: Theme;
  themes: Theme[];
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: THEMES[0],
  themes: THEMES,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((id: string) => {
    const next = THEMES.find(t => t.id === id) || THEMES[0];
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next.id); } catch { /* ignore */ }
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/* ---- Full theme picker (swatch cards), used on the Account Settings page ---- */
export function ThemeSwitcher() {
  const { theme, themes, setTheme } = useTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {themes.map(t => {
        const selected = t.id === theme.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            style={{
              textAlign: 'left', padding: 0, borderRadius: 14, overflow: 'hidden',
              background: 'transparent', cursor: 'pointer',
              border: selected ? `2px solid ${t.tokens['--gold']}` : '2px solid var(--line)',
              boxShadow: selected ? `0 10px 30px color-mix(in srgb, ${t.tokens['--gold']} 30%, transparent)` : 'none',
              transition: 'transform .15s, box-shadow .2s',
            }}
          >
            {/* live preview rendered with this theme's own colors */}
            <div style={{
              position: 'relative', height: 74, padding: 12,
              background: `radial-gradient(circle at top left, ${t.tokens['--bg-top']} 0, ${t.tokens['--bg']} 55%, ${t.tokens['--bg-deep']} 100%)`,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <span style={{ width: 14, height: 14, borderRadius: 5, background: t.tokens['--gold-hi'] }} />
                <span style={{ width: 14, height: 14, borderRadius: 5, background: t.tokens['--gold'] }} />
                <span style={{ width: 14, height: 14, borderRadius: 5, background: t.tokens['--gold-dark'] }} />
                <span style={{ width: 14, height: 14, borderRadius: 5, background: t.tokens['--green'] }} />
                <span style={{ width: 14, height: 14, borderRadius: 5, background: t.tokens['--blue'] }} />
              </div>
              <div style={{
                fontFamily: t.font, fontWeight: 800, fontSize: 18, lineHeight: 1,
                color: t.tokens['--text'],
              }}>
                Aa <span style={{ color: t.tokens['--gold'] }}>Aa</span>
              </div>
              {selected && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center',
                  background: t.tokens['--gold'], color: '#111827',
                }}>
                  <Check size={13} strokeWidth={3} />
                </div>
              )}
            </div>
            <div style={{ padding: '9px 11px', background: 'var(--panel2)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{t.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{t.tagline} · {t.fontName}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
