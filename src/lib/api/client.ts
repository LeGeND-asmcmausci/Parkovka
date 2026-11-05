import { ApiError, normalizeError } from './errors';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
const FORCE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === 'true';

export const USE_FIXTURES = FORCE_FIXTURES || !API_BASE;

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

async function refreshSession() {
  if (!API_BASE || !tokens.refreshToken) {
    clearAuthTokens();
    throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
  }
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokens.refreshToken}`,
    },
  });
  if (!response.ok) {
    clearAuthTokens();
    throw new ApiError('UNAUTHORIZED', 'Session expired', 401);
  }
  const data = unwrapEnvelope<{ accessToken: string; refreshToken?: string }>(
    await response.json(),
  );
  tokens.accessToken = data.accessToken;
  tokens.refreshToken = data.refreshToken ?? tokens.refreshToken;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE) {
    throw new ApiError('NETWORK', 'VITE_API_URL is not configured', 0);
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
