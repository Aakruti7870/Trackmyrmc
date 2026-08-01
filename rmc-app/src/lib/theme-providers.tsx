import { useState, useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  THEMES, ThemeContext, initialTheme, initialPreference,
  applyTheme, loadThemeFont, resolveTheme, writeThemePreference,
  sunTimes, THEME_GEO_KEY,
  type Theme, type ThemeMode,
} from './theme';

/* ─── Geo helpers ────────────────────────────────────────────────────────── */
function readThemeGeo(): { lat: number; lng: number } | null {
  try {
    for (const key of [THEME_GEO_KEY, 'rmc_nearby_location']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const p = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
      if (typeof p.lat === 'number' && typeof p.lng === 'number'
        && Number.isFinite(p.lat) && Number.isFinite(p.lng)
        && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180) {
        return { lat: p.lat, lng: p.lng };
      }
    }
  } catch { /* ignore */ }
  return null;
}

function storeThemeGeo(lat: number, lng: number) {
  try { localStorage.setItem(THEME_GEO_KEY, JSON.stringify({ lat, lng })); } catch { /* best-effort */ }
}

/**
 * Milliseconds until the next sunrise or sunset from `now`.
 * Minimum 30 s so we never busy-loop. Falls back to 60 s if coords yield no
 * valid sun times (polar edge-case).
 */
function msUntilNextCrossing(lat: number, lng: number, now = new Date()): number {
  const times = sunTimes(now, lat, lng);
  if (!times) return 60_000;
  const candidates = [
    times.sunrise.getTime() - now.getTime(),
    times.sunset.getTime()  - now.getTime(),
  ].filter(d => d > 30_000);
  if (candidates.length > 0) return Math.min(...candidates);
  // Both crossings already passed today — wait for tomorrow's sunrise.
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const t2 = sunTimes(tomorrow, lat, lng);
  return t2 ? Math.max(30_000, t2.sunrise.getTime() - now.getTime()) : 3_600_000;
}

/* ─── ThemeProvider ──────────────────────────────────────────────────────── */

/**
 * ThemeProvider — always **'auto'**: switches Concrete Gold ↔ Infra Green at
 * the exact local sunrise/sunset computed via NOAA. Requests
 * `navigator.geolocation` once per session; stores coords in
 * `rmc-theme-geo`; falls back to 06:15 / 18:30 if permission is denied.
 * Re-arms a precise setTimeout at each crossing plus a 60-second polling
 * fallback. There is deliberately no in-app way to pin a fixed theme — the
 * app always reflects the real time of day.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemeMode>(initialPreference);
  const [theme, setThemeState]           = useState<Theme>(initialTheme);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadThemeFont(initialTheme.fontName); }, []);

  /* Apply and reflect the resolved theme for a given preference. */
  const applyResolved = useCallback((pref: ThemeMode) => {
    const next = resolveTheme(pref);
    applyTheme(next);
    loadThemeFont(next.fontName);
    setThemeState(prev => (prev.id === next.id ? prev : next));
  }, []);

  /* Schedule a single precise timeout that fires exactly at the next
     sunrise or sunset, then chains itself for the crossing after that.
     The ref breaks the circular dependency that would otherwise violate
     the react-hooks/immutability rule on `armPreciseFlip`. */
  const armPreciseFlipRef = useRef<(lat: number, lng: number) => void>(() => {});
  const armPreciseFlip = useCallback((lat: number, lng: number) => {
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    const delay = msUntilNextCrossing(lat, lng);
    flipTimerRef.current = setTimeout(() => {
      applyResolved('auto');
      armPreciseFlipRef.current(lat, lng); // chain via ref — avoids TDZ lint error
    }, delay);
  }, [applyResolved]);
  // Keep the ref in sync with the latest stable callback.
  // useLayoutEffect runs synchronously after DOM mutations but before paint,
  // satisfying the react-hooks/refs rule (no ref writes during render).
  useLayoutEffect(() => { armPreciseFlipRef.current = armPreciseFlip; });

  /* ── Auto mode: geolocation + precise flip ──────────────────────────── */
  useEffect(() => {
    if (preference !== 'auto') {
      // Not auto — cancel any pending flip timer.
      if (flipTimerRef.current) { clearTimeout(flipTimerRef.current); flipTimerRef.current = null; }
      return;
    }

    // Apply with whatever coords we already have stored.
    // Deferred via setTimeout to satisfy react-hooks/set-state-in-effect
    // (applyResolved calls setThemeState internally).
    const stored = readThemeGeo();
    if (stored) {
      setTimeout(() => applyResolved('auto'), 0);
      armPreciseFlip(stored.lat, stored.lng);
    }

    // Request fresh geolocation (updates stale cache, first-time grant).
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          storeThemeGeo(lat, lng);
          applyResolved('auto');
          armPreciseFlip(lat, lng); // replaces any timer set from stored coords
        },
        () => { /* denied — clock fallback handles it via the 60-s poll */ },
        { timeout: 10_000, maximumAge: 3_600_000 /* 1 hour */ },
      );
    }

    return () => {
      if (flipTimerRef.current) { clearTimeout(flipTimerRef.current); flipTimerRef.current = null; }
    };
  }, [preference, applyResolved, armPreciseFlip]);

  /* ── 60-second polling fallback ─────────────────────────────────────── */
  /* Covers denied-geolocation (uses clock-based 06:15/18:30 cutoff) and
     ensures the theme is always correct after device sleep/wake. */
  useEffect(() => {
    const tick = () => applyResolved(preference);
    tick(); // apply immediately when preference changes
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [preference, applyResolved]);

  /* ── Exposed setter ───────────────────────────────────────────────────
     No in-app option changes the theme — it is always automatic. This is
     kept only so ThemeCtx has a stable shape; it deliberately ignores
     `mode` and re-asserts 'auto' rather than pinning anything. */
  const setPreference = useCallback((mode: ThemeMode) => {
    void mode;
    writeThemePreference('auto');
    setPreferenceState('auto');
    applyResolved('auto');
  }, [applyResolved]);

  return (
    <ThemeContext.Provider value={{ theme, themes: THEMES, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
