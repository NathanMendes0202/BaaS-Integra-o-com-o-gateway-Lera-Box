import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>(null as unknown as AuthContextValue);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const start = (res: { accessToken: string; user: AuthUser }) => {
    tokenStore.set(res.accessToken);
    setUser(res.user);
  };

  const value: AuthContextValue = {
    user,
    loading,
    login: async (email, password) =>
      start(await api('/auth/login', { body: { email, password }, auth: false })),
    register: async (name, email, password) =>
      start(await api('/auth/register', { body: { name, email, password }, auth: false })),
    logout: () => {
      tokenStore.clear();
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
