import { useState, useEffect, type ReactNode } from 'react';
import { api, type User } from './api';
import { AuthContext } from './auth';
import { clerkSignOutIfEnabled } from './clerk';

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

  async function login(email: string, password: string) {
    const data = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    localStorage.setItem('rmc_token', data.token);
    localStorage.setItem('rmc_user', JSON.stringify(data.user));
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('rmc_token');
    localStorage.removeItem('rmc_user');
    setUser(null);
    // Also end the Clerk session (no-op when Clerk isn't configured) so a staff
    // member who used SSO isn't silently re-authenticated on the next visit.
    void clerkSignOutIfEnabled();
  }

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
