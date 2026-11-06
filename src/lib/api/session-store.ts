import type { AuthSession } from '@/lib/types';

export const SESSION_STORAGE_KEY = 'parkovka.session.v1';

/** Fired when the API rejects both the access and the refresh token. */
export const AUTH_EXPIRED_EVENT = 'parkovka:auth-expired';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSession(): AuthSession | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession | null) {
  const store = storage();
  if (!store) return;
  try {
    if (!session) {
      store.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    store.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* storage can be unavailable in private mode; tokens stay in memory */
  }
}

export function updateSessionTokens(tokens: {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number;
}) {
  const session = readSession();
  if (!session) return;
  writeSession({
    ...session,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? session.refreshToken,
    expiresAt: tokens.expiresAt ?? session.expiresAt,
  });
}

export function emitAuthExpired() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}
