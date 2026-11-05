/**
 * Central error handler middleware for the Smart Parking Management System.
 * 
 * @author Principal Backend Engineer
 * @version 0.1.0
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { logger } from "../utils/logger";

/**
 * Custom HTTP error class
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

/**
 * Zod validation error formatter
 */
const formatZodError = (err: z.ZodError) => {
  const errors: Array<{ path: string; message: string }> = [];
  
  ;(err as z.ZodError).issues.forEach((e) => {
    const path = e.path.join(".");
    errors.push({ path, message: e.message });
  });
  
  return errors;
};

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  }, "Unhandled error");

  // Handle HttpResponseError
  if (err instanceof HttpResponseError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.data && { data: err.data }),
    });
  }

  // Handle Zod validation errors
  if (err instanceof z.ZodError) {
    const zodErr: z.ZodError = err;
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formatZodError(zodErr),
    });
  }

  // Handle Prisma P2002 (unique constraint violation)
  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      message: "A record with this value already exists",
    });
  }

  // Handle Prisma P2003 (foreign key violation)
  if (err.code === "P2003") {
    return res.status(400).json({
      success: false,
      message: "Referenced record not found",
    });
  }

  // Handle Prisma P2014 (record not found)
  if (err.code === "P2014" || err.kind === "not found") {
    return res.status(404).json({
      success: false,
      message: "Record not found",
    });
  }

  // Default: send 500 error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === "production" 
    ? "Internal server error" 
    : err.message || "Internal server error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

/**
 * Route not found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};

/**
 * Async wrapper to avoid try/catch in every route handler
 */
export const asyncHandler = (fn: any) => {
  return (req: Request, res: NextFunction, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};