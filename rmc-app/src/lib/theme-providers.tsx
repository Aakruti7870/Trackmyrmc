import { useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  THEMES, ThemeContext, initialTheme, initialPreference,
  applyTheme, loadThemeFont, resolveTheme, writeThemePreference,
  type Theme, type ThemeMode,
} from './theme';

/**
 * ThemeProvider — supports three modes:
 *
 * 1. 'auto' (default)  — follows the device clock; flips concrete-gold ↔ infra-green
 *    at the exact sunrise/sunset moment, re-checked every 60 s.
 * 2. 'concrete-gold'   — user-pinned light/teal theme.
 * 3. 'trust-blue'      — user-pinned light/blue theme.
 * 4. 'infra-green'     — user-pinned dark theme.
 *
 * The user's choice persists in localStorage and survives app restarts and
 * logout/login (it is a display preference, not session data).
 * Logout must NOT clear the theme preference — it should survive across sessions.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemeMode>(initialPreference);
  const [theme, setThemeState]           = useState<Theme>(initialTheme);

  useEffect(() => {
    loadThemeFont(initialTheme.fontName);
  }, []);

  // Resolve + apply the effective theme for the current preference + clock.
  const applyResolved = useCallback((pref: ThemeMode = preference) => {
    const next = resolveTheme(pref);
    applyTheme(next);
    loadThemeFont(next.fontName);
    setThemeState(prev => (prev.id === next.id ? prev : next));
  }, [preference]);

  // Re-check every minute (and on tab wake) — matters only when preference is
  // 'auto', but the check is cheap so we run it unconditionally.
  useEffect(() => {
    const tick = () => applyResolved(preference);
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [preference, applyResolved]);

  // Exposed setter — updates state, persists to localStorage, applies immediately.
  const setPreference = useCallback((mode: ThemeMode) => {
    writeThemePreference(mode);
    setPreferenceState(mode);
    const next = resolveTheme(mode);
    applyTheme(next);
    loadThemeFont(next.fontName);
    setThemeState(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
