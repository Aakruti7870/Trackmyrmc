import { useState, useEffect, type ReactNode } from 'react';
import { api, type User } from './api';
import { AuthContext } from './auth';
import { clerkSignOutIfEnabled } from './clerk';

// Auto-logout after 30 minutes with no user interaction.
const IDLE_LOGOUT_MS = 30 * 60 * 1000;
// Renew the token on activity at most this often (keeps the sliding window fresh
// without hammering /auth/refresh on every mouse move).
const REFRESH_THROTTLE_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const stored = localStorage.getItem('rmc_user');
    const token = localStorage.getItem('rmc_token');

    async function verify() {
      if (!stored || !token) {
        setLoading(false);
        return;
      }
      // Show the cached user optimistically, but keep loading until the token
      // is verified so a stale session never flashes the authenticated UI.
      try {
        setUser(JSON.parse(stored));
      } catch {
        // Corrupt cache — drop it and treat as logged out.
        localStorage.removeItem('rmc_user');
        localStorage.removeItem('rmc_token');
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      try {
        const me = await api.get<User>('/auth/me');
        if (cancelled) return;
        setUser(me);
        localStorage.setItem('rmc_user', JSON.stringify(me));
      } catch {
        // A 401 is handled by the api layer (session cleared + redirect to
        // /login). For any failure, drop the in-memory user so the protected
        // UI is never shown with an invalid session.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    verify();

    function handleStorage(e: StorageEvent) {
      // React to auth-key changes (login/logout/account switch) in other tabs.
      // e.key is null when storage is cleared entirely.
      if (e.key !== null && e.key !== 'rmc_user' && e.key !== 'rmc_token') return;
      const nextStored = localStorage.getItem('rmc_user');
      const nextToken = localStorage.getItem('rmc_token');
      if (nextStored && nextToken) {
        try {
          setUser(JSON.parse(nextStored));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  async function login(email: string, password: string, plantCode?: string) {
    const data = await api.post<{ token: string; user: User }>('/auth/login', {
      email, password, ...(plantCode ? { plantCode } : {}),
    });
    localStorage.setItem('rmc_token', data.token);
    localStorage.setItem('rmc_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('rmc_token');
    localStorage.removeItem('rmc_user');
    setUser(null);
    // Also end the Clerk session (no-op when Clerk isn't configured) so a staff
    // member who used SSO isn't silently re-authenticated on the next visit.
    void clerkSignOutIfEnabled();
  }

  // Idle auto-logout + sliding session renewal. While someone is signed in we
  // arm a 30-minute inactivity timer that logs them out, and on real activity
  // (throttled) we mint a fresh short-lived token via /auth/refresh so an active
  // user is never kicked mid-task. Backend short TTL + this renewal together
  // enforce the 30-min idle window; staff tokens are single-session, so a 401
  // from a superseded session is handled by the api layer (clear + redirect).
  useEffect(() => {
    if (!user) return;
    let idleTimer: ReturnType<typeof setTimeout>;
    let lastRefresh = Date.now();

    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => logout(), IDLE_LOGOUT_MS);
    };

    const onActivity = () => {
      resetIdle();
      const now = Date.now();
      if (now - lastRefresh >= REFRESH_THROTTLE_MS) {
        lastRefresh = now;
        api.post<{ token: string }>('/auth/refresh', {})
          .then(r => { if (r?.token) localStorage.setItem('rmc_token', r.token); })
          .catch(() => { /* 401 → cleared+redirected by the api layer */ });
      }
    };

    const events: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    resetIdle();
    return () => {
      clearTimeout(idleTimer);
      events.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, [user]);

  function updateUser(updated: User, token?: string) {
    setUser(updated);
    localStorage.setItem('rmc_user', JSON.stringify(updated));
    if (token) {
      localStorage.setItem('rmc_token', token);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
