import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { login as loginApi } from '../api/endpoints';
import type { Role, User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
  canInteract: boolean;
  isAdmin: boolean;
  isIanimateur: boolean;
}

const AuthContext = createContext<AuthContextValue>(null as any);

function readUser(): User | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUser);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  const value = useMemo<AuthContextValue>(() => {
    const hasRole = (...roles: Role[]) => !!user && user.roles.some((r) => roles.includes(r));
    const isAdmin = hasRole('admin');
    const isIanimateur = hasRole('ianimateur', 'admin');
    const canInteract = isAdmin || hasRole('iambassadeur', 'iaeclaireur', 'ianimateur');
    return {
      user, token, hasRole, isAdmin, isIanimateur, canInteract,
      async login(username: string, password: string) {
        const data = await loginApi(username, password);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      },
      logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      },
    };
  }, [user, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
