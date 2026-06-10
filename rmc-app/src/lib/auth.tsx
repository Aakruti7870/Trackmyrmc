import { createContext, useContext } from 'react';
import { type User } from './api';

export interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updated: User, token?: string) => void;
}

export const AuthContext = createContext<AuthCtx>({
  user: null, loading: true,
  login: async () => {}, logout: () => {}, updateUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
