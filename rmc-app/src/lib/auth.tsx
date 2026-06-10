import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, type User } from './api';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updated: User, token?: string) => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true,
  login: async () => {}, logout: () => {}, updateUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('rmc_user');
    const token = localStorage.getItem('rmc_token');
    if (stored && token) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);

    function handleStorage(e: StorageEvent) {
      if (e.key !== 'rmc_user' && e.key !== null) return;
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
    return () => window.removeEventListener('storage', handleStorage);
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

export function useAuth() {
  return useContext(AuthContext);
}
