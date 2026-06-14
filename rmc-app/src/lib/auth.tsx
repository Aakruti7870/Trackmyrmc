import { createContext, useContext } from 'react';
import { type User } from './api';

export interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateUser: (updated: User, token?: string) => void;
}

export const AuthContext = createContext<AuthCtx>({
  user: null, loading: true,
  login: async () => { throw new Error('AuthProvider is not mounted'); }, logout: () => {}, updateUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
