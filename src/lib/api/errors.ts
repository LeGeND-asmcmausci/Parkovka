export type ApiErrorCode =
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'SPACE_UNAVAILABLE'
  | 'PAYMENT_FAILED'
  | 'EMAIL_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'NOT_SUPPORTED'
  | 'SERVER';

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  details?: Record<string, string>;

  constructor(code: ApiErrorCode, message: string, status = 400, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function normalizeError(error: unknown): ApiError {
  if (isApiError(error)) return error;
  if (error instanceof TypeError) {
    return new ApiError('NETWORK', 'Network request failed', 0);
  }
  if (error instanceof Error) {
    return new ApiError('SERVER', error.message, 500);
  }
  return new ApiError('SERVER', 'Unexpected error', 500);
}
