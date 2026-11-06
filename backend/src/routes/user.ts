import { Router, Request, Response, NextFunction } from "express";
import { body } from "express-validator";
import bcrypt from "bcrypt";
import { validate } from "../middleware/validation";
import { authenticate, authorize } from "../utils/jwt";
import { prisma } from "../utils/db";
import { createError, ErrorMessages } from "../utils/http-error";

const router = Router();

/**
 * @route POST /api/users
 * @desc Create an ADMIN, GUARD or USER account (admin only)
 * @access Private - Admin only
 *
 * Public registration can never assign staff roles; this protected endpoint is
 * the only way to create them.
 */
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").trim().isEmail().withMessage("Valid email required").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role").isIn(["ADMIN", "GUARD", "USER"]).withMessage("Invalid role"),
    body("phone").optional().trim(),
    body("licensePlate").optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, role, phone, licensePlate } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return next(createError(409, ErrorMessages.CONFLICT));
      }

      const saltRounds = Number(process.env.BCRYPT_ROUNDS) || 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          status: "ACTIVE",
          phone: phone || null,
          licensePlate: licensePlate || null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

      res.status(201).json({
        success: true,
        data: { user },
        message: "User created successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/users/me
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
        return next(createError(404, ErrorMessages.NOT_FOUND));
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
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PATCH /api/users/profile
 * @desc Update user profile
 * @access Private
 */
router.patch(
  "/profile",
  authenticate,
  [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("phone").optional().trim(),
    body("licensePlate").optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      const { name, phone, licensePlate } = req.body;

      const updateData: { name?: string; phone?: string; licensePlate?: string } = {};
      if (name) updateData.name = name;
      if (phone) updateData.phone = phone;
      if (licensePlate) updateData.licensePlate = licensePlate;

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          licensePlate: true,
          status: true,
        },
      });

      res.json({
        success: true,
        data: user,
        message: "Profile updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/users
 * @desc Get all users (admin only)
 * @access Private - Admin only
 */
router.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
