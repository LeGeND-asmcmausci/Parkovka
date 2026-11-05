/**
 * HTTP error utilities for the Smart Parking Management System.
 * 
 * @author Principal Backend Engineer
 * @version 0.1.0
 */

export class HttpResponseError extends Error {
  public statusCode: number;
  public data?: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.name = "HttpResponseError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Standardized error response
 */
export const createError = (statusCode: number, message: string, data?: unknown) => {
  throw new HttpResponseError(message, statusCode, data);
};

/**
 * Error status codes mapping
 */
export const ErrorCodes = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER: 500,
};

/**
 * Common error messages
 */
export const ErrorMessages = {
  VALIDATION_FAILED: "Validation failed",
  UNAUTHORIZED_ACCESS: "Unauthorized access",
  FORBIDDEN_ACCESS: "Forbidden: insufficient permissions",
  NOT_FOUND: "Resource not found",
  CONFLICT: "Resource conflict",
  INTERNAL_ERROR: "Internal server error",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
  PAYMENT_FAILED: "Payment failed",
  RESERVATION_CONFLICT: "Reservation conflict - space may already be booked",
  SESSION_EXPIRED: "Parking session expired",
  QR_CODE_INVALID: "Invalid or expired QR code",
  QR_CODE_USED: "QR code already used",
};