/**
 * JWT authentication utilities for the Smart Parking Management System.
 *
 * Access and refresh tokens are explicitly typed (`typ` claim) so a refresh
 * token can never be used as an access token and vice versa.
 *
 * `authenticate` resolves the user from the database on every request: the role
 * and status in the token are never trusted, so a demoted or suspended account
 * loses access immediately instead of when its access token expires.
 */

import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { createError, ErrorMessages } from "./http-error";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-to-a-secure-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

export type TokenType = "access" | "refresh";

export interface TokenUser {
  id: string;
  email: string;
  role: string;
}

export interface TypedJwtPayload extends jwt.JwtPayload {
  sub: string;
  typ: TokenType;
}

/**
 * Generate access token
 */
export const generateAccessToken = (user: TokenUser): string => {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: "access" satisfies TokenType,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
};

/**
 * Generate refresh token (`jti` lets each session be revoked individually).
 */
export const generateRefreshToken = (userId: string, jti: string): string => {
  return jwt.sign(
    { sub: userId, jti, typ: "refresh" satisfies TokenType },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN } as jwt.SignOptions
  );
};

const verifyTypedToken = (token: string, expected: TokenType): TypedJwtPayload => {
  const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

  if (!payload || payload.typ !== expected || typeof payload.sub !== "string") {
    throw new Error(`Invalid ${expected} token`);
  }

  return payload as TypedJwtPayload;
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): TypedJwtPayload =>
  verifyTypedToken(token, "access");

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): TypedJwtPayload =>
  verifyTypedToken(token, "refresh");

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (header: string | undefined): string | null => {
  if (!header) return null;

  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer" && parts[1]) {
    return parts[1];
  }

  return null;
};

/**
 * Role-based access control middleware
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !req.user.role) {
      return next(createError(401, ErrorMessages.UNAUTHORIZED_ACCESS));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(createError(403, ErrorMessages.FORBIDDEN_ACCESS));
    }

    next();
  };
};

/**
 * Authenticate JWT token middleware.
 *
 * The token only proves identity; role/email/status always come from the DB.
 */
export const authenticate = async (req: any, res: any, next: any) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      return next(createError(401, ErrorMessages.UNAUTHORIZED_ACCESS));
    }

    let payload: TypedJwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(createError(401, ErrorMessages.UNAUTHORIZED_ACCESS));
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (!user) {
      return next(createError(401, ErrorMessages.UNAUTHORIZED_ACCESS));
    }

    if (user.status !== "ACTIVE") {
      return next(createError(403, ErrorMessages.FORBIDDEN_ACCESS));
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};
