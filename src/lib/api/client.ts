import { ApiError, normalizeError } from './errors';
import { emitAuthExpired, updateSessionTokens, writeSession } from './session-store';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
const FORCE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === 'true';
const IS_DEV = Boolean(import.meta.env.DEV);
const IS_TEST = import.meta.env.MODE === 'test';

/**
 * Fixture data is allowed only as an explicit development/test mode. A missing
 * `VITE_API_URL` in a production build never falls back to fake data: requests
 * fail with NETWORK so the UI shows the real error state.
 */
export const USE_FIXTURES = FORCE_FIXTURES || (IS_DEV && !API_BASE) || (IS_TEST && !API_BASE);

export const hasApiBase = Boolean(API_BASE);

interface TokenPair {
  accessToken: string | null;
  refreshToken: string | null;
}

const tokens: TokenPair = { accessToken: null, refreshToken: null };

export function setAuthTokens(pair: TokenPair) {
  tokens.accessToken = pair.accessToken;
  tokens.refreshToken = pair.refreshToken;
}

export function clearAuthTokens() {
  tokens.accessToken = null;
  tokens.refreshToken = null;
}

export function getAccessToken() {
  return tokens.accessToken;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  skipRefresh?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

function unwrapEnvelope<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function tokenExpiry(token: string | undefined): number {
  const fallback = Date.now() + 15 * 60_000;
  if (!token) return fallback;
  try {
    const payload = token.split('.')[1];
    if (!payload) return fallback;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(normalized)) as { exp?: number };
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : fallback;
  } catch {
    return fallback;
  }
}

function failSession(): never {
  clearAuthTokens();
  writeSession(null);
  emitAuthExpired();
  throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
}

let refreshInFlight: Promise<void> | null = null;

async function requestRefresh(): Promise<void> {
  if (!API_BASE || !tokens.refreshToken) failSession();

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokens.refreshToken}`,
    },
  });
  if (!response.ok) failSession();

  const data = unwrapEnvelope<{ accessToken: string; refreshToken?: string }>(
    await response.json(),
  );
  tokens.accessToken = data.accessToken;
  tokens.refreshToken = data.refreshToken ?? tokens.refreshToken;
  // The backend rotates the refresh token on every refresh; persist the pair so
  // a page reload does not replay the revoked token.
  updateSessionTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken ?? tokens.refreshToken,
    expiresAt: tokenExpiry(data.accessToken),
  });
}

/** One refresh at a time: concurrent 401s share the same rotation. */
function refreshSession(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = requestRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE) {
    throw new ApiError(
      'NETWORK',
      USE_FIXTURES
        ? 'Fixture mode is active; configure VITE_API_URL to call the backend.'
        : 'VITE_API_URL is not configured',
      0,
    );
  }

  const send = async () => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (tokens.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;

    const response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });

    if (response.status === 204) return undefined as T;

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      const code = mapErrorCode(response.status, payload, path);
      throw new ApiError(code, payload?.message ?? response.statusText, response.status, extractDetails(payload));
    }
    return unwrapEnvelope<T>(payload);
  };

  try {
    return await send();
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      !options.skipRefresh &&
      Boolean(tokens.refreshToken)
    ) {
      await refreshSession();
      return send();
    }
    if (error instanceof ApiError && error.status === 401 && !options.skipRefresh) {
      failSession();
    }
    throw normalizeError(error);
  }
}

type ApiErrorCodeLite = ConstructorParameters<typeof ApiError>[0];

interface ErrorPayload {
  message?: string;
  errors?: { path?: string; msg?: string; message?: string }[];
  data?: Record<string, unknown>;
}

function mapErrorCode(status: number, payload: unknown, path: string): ApiErrorCodeLite {
  const message = String((payload as ErrorPayload | null)?.message ?? '');
  if (/reservation conflict|space.*(booked|unavailable)|already reserved/i.test(message)) {
    return 'SPACE_UNAVAILABLE';
  }
  if (status === 409 && /exist/i.test(message) && path.includes('/auth/register')) {
    return 'EMAIL_TAKEN';
  }
  if (status === 409 && /exist/i.test(message) && path.includes('/users')) {
    return 'EMAIL_TAKEN';
  }
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 400 || status === 409 || status === 422) return 'VALIDATION';
  return 'SERVER';
}

function extractDetails(payload: unknown): Record<string, string> | undefined {
  const parsed = payload as ErrorPayload | null;
  const details: Record<string, string> = {};
  if (Array.isArray(parsed?.errors)) {
    parsed.errors.forEach((item, index) => {
      const key = item.path || `field${index + 1}`;
      const value = item.msg || item.message;
      if (value) details[key] = value;
    });
  }
  if (parsed?.data && typeof parsed.data === 'object') {
    Object.entries(parsed.data).forEach(([key, value]) => {
      if (typeof value === 'string') details[key] = value;
    });
  }
  return Object.keys(details).length > 0 ? details : undefined;
}
