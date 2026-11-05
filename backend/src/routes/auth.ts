import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { validate } from "../middleware/validation";
import { authenticate, authorize, generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken, extractTokenFromHeader } from "../utils/jwt";
import { User } from "../models/user";
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import { createError, ErrorCodes, ErrorMessages } from "../utils/http-error";
import bcrypt from "bcrypt";
import crypto from "crypto";

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role").optional().isIn(["ADMIN", "GUARD", "USER"]).withMessage("Invalid role"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, role } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return next(createError(409, ErrorCodes.CONFLICT));
      }

      // Hash password
      const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Default role if not provided
      const userRole: "ADMIN" | "GUARD" | "USER" = role || "USER";

      // Create user
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: userRole,
          status: "ACTIVE",
        },
      });

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = generateRefreshToken(user.id);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
        message: "User registered successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  "/login",
  [
    body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password required"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return next(createError(401, ErrorCodes.UNAUTHORIZED));
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return next(createError(401, ErrorCodes.UNAUTHORIZED));
      }

      if (user.status !== "ACTIVE") {
        return next(createError(403, ErrorCodes.FORBIDDEN));
      }

      const accessToken = generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = generateRefreshToken(user.id);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
        message: "Login successful",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authorization = req.headers.authorization;
      const token = extractTokenFromHeader(authorization);

      if (!token) {
        return next(createError(401, ErrorCodes.UNAUTHORIZED));
      }

      const payload = verifyRefreshToken(token);

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
      next(createError(401, ErrorCodes.UNAUTHORIZED));
    }
  }
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user and revoke refresh token
 * @access Private
 */
router.post(
  "/logout",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return next(createError(404, ErrorCodes.NOT_FOUND));
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          licensePlate: true,
          status: true,
          createdAt: true,
        },
      });

      if (!user) {
        return next(createError(404, ErrorCodes.NOT_FOUND));
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;