/**
 * Central error handler middleware for the Smart Parking Management System.
 *
 * There is exactly one `HttpResponseError` class in the codebase
 * (`src/utils/http-error.ts`). This module re-exports it so both import paths
 * point at the same constructor and `instanceof` checks never fail.
 *
 * Client responses never contain stack traces, regardless of NODE_ENV.
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import logger from "../utils/logger";
import { HttpResponseError } from "../utils/http-error";

export { HttpResponseError, createError, ErrorCodes, ErrorMessages } from "../utils/http-error";

/**
 * Zod validation error formatter
 */
const formatZodError = (err: z.ZodError) => {
  const errors: Array<{ path: string; message: string }> = [];

  err.issues.forEach((e) => {
    errors.push({ path: e.path.join("."), message: e.message });
  });

  return errors;
};

const isHttpResponseError = (err: unknown): err is HttpResponseError =>
  err instanceof HttpResponseError ||
  // Defensive: a duplicated copy of the class (two module graphs) still carries
  // the marker fields, so status codes are preserved either way.
  (typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "HttpResponseError" &&
    typeof (err as { statusCode?: unknown }).statusCode === "number");

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Full detail stays in server logs only.
  logger.error(
    {
      error: err?.message,
      stack: err?.stack,
      code: err?.code,
      path: req.path,
      method: req.method,
    },
    "Unhandled error"
  );

  if (res.headersSent) {
    return next(err);
  }

  if (isHttpResponseError(err)) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.data !== undefined && { data: err.data }),
    });
  }

  if (err instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formatZodError(err),
    });
  }

  // Prisma unique constraint violation
  if (err?.code === "P2002") {
    return res.status(409).json({
      success: false,
      message: "A record with this value already exists",
    });
  }

  // Prisma foreign key violation
  if (err?.code === "P2003") {
    return res.status(400).json({
      success: false,
      message: "Referenced record not found",
    });
  }

  // Prisma record not found
  if (err?.code === "P2014" || err?.kind === "not found" || err?.code === "P2025") {
    return res.status(404).json({
      success: false,
      message: "Record not found",
    });
  }

  const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
  const message =
    statusCode >= 500
      ? "Internal server error"
      : typeof err?.message === "string" && err.message
        ? err.message
        : "Request failed";

  res.status(statusCode).json({ success: false, message });
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
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
