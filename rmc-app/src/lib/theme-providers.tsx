import { useState, useCallback, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { THEMES, ThemeContext, initialTheme, applyTheme, persistTheme, useTheme } from './theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(initialTheme);

  const setTheme = useCallback((id: string) => {
    const next = THEMES.find(t => t.id === id) || THEMES[0];
    applyTheme(next);
    persistTheme(next);
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
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
