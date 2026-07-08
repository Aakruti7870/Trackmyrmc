import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import {
  THEMES, THEME_MODES, ThemeContext, initialMode, initialTheme,
  applyTheme, loadThemeFont, persistMode, resolveTheme, useTheme,
  type Theme, type ThemeMode,
} from './theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    loadThemeFont(initialTheme.fontName);
  }, []);

  const applyResolved = useCallback((nextMode: ThemeMode) => {
    const next = resolveTheme(nextMode);
    applyTheme(next);
    loadThemeFont(next.fontName);
    setThemeState(prev => (prev.id === next.id ? prev : next));
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    persistMode(nextMode);
    setModeState(nextMode);
    applyResolved(nextMode);
  }, [applyResolved]);

  /* In Auto mode, re-check the clock every minute (and when the tab wakes up)
     so the app flips Day <-> Night at sunrise/sunset without a reload. */
  useEffect(() => {
    if (mode !== 'auto') return;
    const tick = () => applyResolved('auto');
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [mode, applyResolved]);

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ---- Full theme-mode picker (swatch cards), used on the Account Settings page ---- */
export function ThemeSwitcher() {
  const { theme, mode, setMode } = useTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))', gap: 12 }}>
      {THEME_MODES.map(m => {
        const selected = m.id === mode;
        // Preview colors: forced modes preview themselves; Auto previews the currently active theme.
        const t = m.id === 'auto' ? theme : (THEMES.find(x => x.id === m.id) || THEMES[0]);
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            style={{
              textAlign: 'left', padding: 0, borderRadius: 14, overflow: 'hidden',
              background: 'transparent', cursor: 'pointer',
              border: selected ? `2px solid ${t.tokens['--gold']}` : '2px solid var(--line)',
              boxShadow: selected ? `0 10px 30px color-mix(in srgb, ${t.tokens['--gold']} 30%, transparent)` : 'none',
              transition: 'transform .15s, box-shadow .2s',
            }}
          >
            {/* live preview rendered with the target theme's own colors */}
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
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: t.font, fontWeight: 800, fontSize: 18, lineHeight: 1,
                color: t.tokens['--text'],
              }}>
                <m.Icon size={16} style={{ color: t.tokens['--gold'] }} />
                Aa <span style={{ color: t.tokens['--gold'] }}>Aa</span>
              </div>
              {selected && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center',
                  background: t.tokens['--gold'], color: '#ffffff',
                }}>
                  <Check size={13} strokeWidth={3} />
                </div>
              )}
            </div>
            <div style={{ padding: '9px 11px', background: 'var(--panel2)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{m.label}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>{m.hint}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
