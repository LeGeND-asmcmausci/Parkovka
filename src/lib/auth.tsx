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
import {
  AUTH_EXPIRED_EVENT,
  readSession,
  writeSession,
} from '@/lib/api/session-store';

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
  logout: () => Promise<void>;
  patchUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function usableSession(session: AuthSession | null): AuthSession | null {
  if (!session?.accessToken || !session.user) return null;
  // An expired access token is fine when a refresh token exists: the first
  // authorized request will refresh and retry.
  if (!session.refreshToken && session.expiresAt && session.expiresAt < Date.now()) return null;
  return session;
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
    const stored = usableSession(readSession());
    if (!stored) {
      if (readSession()) writeSession(null);
      setStatus('anonymous');
      return;
    }
    setAuthTokens({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
    api.auth
      .me(stored.accessToken)
      .then((freshUser) => {
        if (cancelled) return;
        setUser(freshUser);
        // The client may have rotated the tokens while `me` was in flight;
        // persist against the newest copy instead of the stale closure value.
        const latest = readSession() ?? stored;
        writeSession({ ...latest, user: freshUser });
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        clearAuthTokens();
        writeSession(null);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const completeLogin = useCallback((session: AuthSession) => {
    setAuthTokens({ accessToken: session.accessToken, refreshToken: session.refreshToken });
    writeSession(session);
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

  const logout = useCallback(async () => {
    const refreshToken = readSession()?.refreshToken;
    try {
      // Revoke the refresh token server-side; the access token keeps working
      // until it expires, which the backend documents.
      await api.auth.logout(refreshToken);
    } catch {
      /* a failed revoke must not keep the user signed in locally */
    } finally {
      clearAuthTokens();
      writeSession(null);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const patchUser = useCallback((next: User) => {
    setUser(next);
    const stored = readSession();
    if (stored) writeSession({ ...stored, user: next });
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
