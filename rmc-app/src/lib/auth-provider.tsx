import { useState, useEffect, type ReactNode } from 'react';
import { api, API_ORIGIN, type User } from './api';
import { AuthContext } from './auth';
import { clerkSignOutIfEnabled } from './clerk';
import NativeRuntimeSync from '@/components/NativeRuntimeSync';
import { stopCheckedInTracking, setWidgetAuthToken, clearAllWidgetData } from './liveWidget';
import { resolveCustomerDisplayName, type CustomerIdentityLike } from './customerIdentity';

const IDLE_LOGOUT_MS = 30 * 60 * 1000;
const REFRESH_THROTTLE_MS = 5 * 60 * 1000;

type IdentityAwareUser = User & CustomerIdentityLike;

function normalizeAuthenticatedUser(raw: User): User {
  const user = raw as IdentityAwareUser;
  if (user.role !== 'client') return raw;
  return { ...raw, name: resolveCustomerDisplayName(user) };
}

function readCachedUser(value: string): User {
  return normalizeAuthenticatedUser(JSON.parse(value) as User);
}

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
      try {
        setUser(readCachedUser(stored));
      } catch {
        localStorage.removeItem('rmc_user');
        localStorage.removeItem('rmc_token');
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      try {
        const response = await api.get<User>('/auth/me');
        if (cancelled) return;
        const me = normalizeAuthenticatedUser(response);
        setUser(me);
        localStorage.setItem('rmc_user', JSON.stringify(me));
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    verify();

    function handleStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== 'rmc_user' && e.key !== 'rmc_token') return;
      const nextStored = localStorage.getItem('rmc_user');
      const nextToken = localStorage.getItem('rmc_token');
      if (nextStored && nextToken) {
        try {
          setUser(readCachedUser(nextStored));
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
        void stopCheckedInTracking();
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
    const normalizedUser = normalizeAuthenticatedUser(data.user);
    // Clear any stale widget data from a previous user before storing new credentials.
    try { await clearAllWidgetData(); } catch { /* no-op on web */ }
    localStorage.setItem('rmc_token', data.token);
    localStorage.setItem('rmc_user', JSON.stringify(normalizedUser));
    setUser(normalizedUser);
    // Persist auth token in native SharedPreferences so widget background refresh works.
    try {
      await setWidgetAuthToken(
        data.token,
        API_ORIGIN,
        normalizedUser.role,
        String(normalizedUser.id),
      );
    } catch { /* no-op on web */ }
    return normalizedUser;
  }

  function logout() {
    void stopCheckedInTracking();
    // Clear widget data and auth token immediately so no stale data persists.
    try { void clearAllWidgetData(); } catch { /* no-op on web */ }
    localStorage.removeItem('rmc_token');
    localStorage.removeItem('rmc_user');
    sessionStorage.removeItem('rmc_ai_session');
    setUser(null);
    void clerkSignOutIfEnabled();
  }

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
          .catch(() => { /* 401 is handled by the API layer. */ });
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
    const normalizedUser = normalizeAuthenticatedUser(updated);
    setUser(normalizedUser);
    localStorage.setItem('rmc_user', JSON.stringify(normalizedUser));
    if (token) localStorage.setItem('rmc_token', token);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      <NativeRuntimeSync />
      {children}
    </AuthContext.Provider>
  );
}
