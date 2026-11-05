import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthSession, Role, User } from '@/lib/types';
import { api } from '@/lib/api';
import { clearAuthTokens, setAuthTokens } from '@/lib/api/client';

const STORAGE_KEY = 'parkovka.session.v1';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<User>;
  logout: () => void;
  patchUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.user) return null;
    // An expired access token is fine when a refresh token exists: the first
    // authorized request will refresh and retry.
    if (!parsed.refreshToken && parsed.expiresAt && parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(session: AuthSession | null) {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function roleHome(role: Role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'GUARD') return '/guard';
  return '/app';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredSession();
    if (!stored) {
      setStatus('anonymous');
      return;
    }
    setAuthTokens({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
    api.auth
      .me(stored.accessToken)
      .then((freshUser) => {
        if (cancelled) return;
        setUser(freshUser);
        persistSession({ ...stored, user: freshUser });
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthTokens();
        persistSession(null);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const completeLogin = useCallback((session: AuthSession) => {
    setAuthTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    persistSession(session);
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => completeLogin(await api.auth.login(email, password)),
    [completeLogin],
  );

  const register = useCallback(
    async (input: { fullName: string; email: string; phone: string; password: string }) =>
      completeLogin(await api.auth.register(input)),
    [completeLogin],
  );

  const logout = useCallback(() => {
    clearAuthTokens();
    persistSession(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const patchUser = useCallback((next: User) => {
    setUser(next);
    const stored = readStoredSession();
    if (stored) persistSession({ ...stored, user: next });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, register, logout, patchUser }),
    [user, status, login, register, logout, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
