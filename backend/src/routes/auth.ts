import { Router, Request, Response, NextFunction } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validation";
import { authenticate, extractTokenFromHeader, verifyRefreshToken } from "../utils/jwt";
import { prisma } from "../utils/db";
import {
  issueTokens,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../utils/tokens";
import { createError, ErrorCodes, ErrorMessages } from "../utils/http-error";
import bcrypt from "bcrypt";

const router = Router();

const hashRounds = () => Number(process.env.BCRYPT_ROUNDS) || 12;

/**
 * @route POST /api/auth/register
 * @desc Register a new user. Always creates a USER account.
 * @access Public
 *
 * Any `role` field in the body is ignored on purpose: self-service signup can
 * never grant ADMIN or GUARD. Staff accounts are created by an ADMIN through
 * `POST /api/users`.
 */
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return next(createError(ErrorCodes.CONFLICT, ErrorMessages.CONFLICT));
      }

      const passwordHash = await bcrypt.hash(password, hashRounds());

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "USER",
          status: "ACTIVE",
        },
      });

      const tokens = await issueTokens({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          tokens,
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

      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return next(createError(ErrorCodes.UNAUTHORIZED, ErrorMessages.UNAUTHORIZED_ACCESS));
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return next(createError(ErrorCodes.UNAUTHORIZED, ErrorMessages.UNAUTHORIZED_ACCESS));
      }

      if (user.status !== "ACTIVE") {
        return next(createError(ErrorCodes.FORBIDDEN, ErrorMessages.FORBIDDEN_ACCESS));
      }

      const tokens = await issueTokens({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          tokens,
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
 * @desc Exchange a valid refresh token for a new token pair
 * @access Public (requires refresh token)
 *
 * - Only refresh-typed tokens are accepted (an access token fails).
 * - Role/email are loaded from the database, never copied from the token.
 * - The presented refresh token is revoked on use (rotation); logged-out or
 *   replayed tokens fail with 401.
 */
router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token =
      extractTokenFromHeader(req.headers.authorization) ??
      (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null);

    if (!token) {
      return next(createError(ErrorCodes.UNAUTHORIZED, ErrorMessages.UNAUTHORIZED_ACCESS));
    }

    let userId: string;
    try {
      userId = verifyRefreshToken(token).sub;
    } catch {
      return next(createError(ErrorCodes.UNAUTHORIZED, ErrorMessages.UNAUTHORIZED_ACCESS));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user) {
      return next(createError(ErrorCodes.UNAUTHORIZED, ErrorMessages.UNAUTHORIZED_ACCESS));
    }

    if (user.status !== "ACTIVE") {
      return next(createError(ErrorCodes.FORBIDDEN, ErrorMessages.FORBIDDEN_ACCESS));
    }

    const tokens = await rotateRefreshToken(token, {
      id: user.id,
      email: user.email,
      role: user.role,
    });

    if (!tokens) {
      return next(createError(ErrorCodes.UNAUTHORIZED, ErrorMessages.UNAUTHORIZED_ACCESS));
    }

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout and revoke refresh token(s)
 * @access Private
 *
 * Revokes the refresh token supplied in the body when present (single device),
 * otherwise every active refresh token of the user. Access tokens stay valid
 * for their remaining lifetime (<= 15 minutes) by design.
 */
router.post(
  "/logout",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(createError(ErrorCodes.UNAUTHORIZED, ErrorMessages.UNAUTHORIZED_ACCESS));
      }

      const providedToken =
        typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null;

      if (providedToken) {
        await revokeRefreshToken(userId, providedToken);
      } else {
        await revokeAllRefreshTokens(userId);
      }

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
        return next(createError(ErrorCodes.NOT_FOUND, ErrorMessages.NOT_FOUND));
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
          updatedAt: true,
        },
      });

      if (!user) {
        return next(createError(ErrorCodes.NOT_FOUND, ErrorMessages.NOT_FOUND));
      }

      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
