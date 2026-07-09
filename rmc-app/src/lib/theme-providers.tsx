import { useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  THEMES, ThemeContext, initialTheme,
  applyTheme, loadThemeFont, resolveTheme,
  type Theme,
} from './theme';

/* The app permanently follows the clock (sunrise/sunset) — there is no
   user-facing theme picker. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    loadThemeFont(initialTheme.fontName);
  }, []);

  const applyResolved = useCallback(() => {
    const next = resolveTheme('auto');
    applyTheme(next);
    loadThemeFont(next.fontName);
    setThemeState(prev => (prev.id === next.id ? prev : next));
  }, []);

  /* Re-check the clock every minute (and when the tab wakes up) so the app
     flips Day <-> Night at sunrise/sunset without a reload. */
  useEffect(() => {
    const tick = () => applyResolved();
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [applyResolved]);

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
