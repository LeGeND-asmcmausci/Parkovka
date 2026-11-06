/**
 * JWT authentication utilities for the Smart Parking Management System.
 * 
 * @author Principal Backend Engineer
 * @version 0.1.0
 */

import jwt from "jsonwebtoken";
import { User } from "../models/user";
import { createError, ErrorMessages } from "./http-error";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-to-a-secure-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

/**
 * Generate access token
 */
export const generateAccessToken = (user: { id: string; email: string; role: string }): string => {
  return jwt.sign(
    { 
      sub: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { sub: userId },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN } as jwt.SignOptions
  );
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): jwt.JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): jwt.JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (header: string | undefined): string | null => {
  if (!header) return null;
  
  const parts = header.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
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
 * Authenticate JWT token middleware
 */
export const authenticate = async (req: any, res: any, next: any) => {
  try {
    const authorization = req.headers.authorization;
    const token = extractTokenFromHeader(authorization);
    
    if (!token) {
      return next(createError(401, ErrorMessages.UNAUTHORIZED_ACCESS));
    }
    
    const payload = verifyAccessToken(token);
    
    // Attach user to request
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    
    next();
  } catch (error) {
    next(createError(401, ErrorMessages.UNAUTHORIZED_ACCESS));
  }
};

/**
 * Refresh token middleware - for obtaining new access token
 */
export const refreshAuth = async (req: any, res: any, next: any) => {
  try {
    const authorization = req.headers.authorization;
    const token = extractTokenFromHeader(authorization);
    
    if (!token) {
      return next(createError(401, ErrorMessages.UNAUTHORIZED_ACCESS));
    }
    
    const payload = verifyRefreshToken(token);
    
    // Check if refresh token is still valid (not revoked, etc.)
    // In production, check Redis or database for revoked tokens
    
    const user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(payload.sub);
    
    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    next(createError(401, ErrorMessages.UNAUTHORIZED_ACCESS));
  }
};