import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { validate } from "../middleware/validation";
import { authenticate, authorize } from "../utils/jwt";
import { User } from "../models/user";
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import { createError, ErrorCodes, ErrorMessages } from "../utils/http-error";

const router = Router();


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
      
      res.json({
        success: true,
        data: user,
      });
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
      
      const updateData: any = {};
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
      
      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;