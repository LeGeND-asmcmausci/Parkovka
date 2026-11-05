import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { validate } from "../middleware/validation";
import { authenticate, authorize } from "../utils/jwt";
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import { createError, ErrorCodes, ErrorMessages } from "../utils/http-error";
import { cacheAvailability, invalidateCache } from "../utils/redis";
import crypto from "crypto";

const router = Router();

// Helper: validate request results
const validate = (req: Request, res: NextFunction, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Generate a cryptographically secure QR token
 */
const generateQrToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * @route POST /api/reservations
 * @desc Create a new reservation
 * @access Private
 */
router.post(
  "/",
  authenticate,
  [
    body("facilityId").isUUID().withMessage("Invalid facility ID"),
    body("spaceId").isUUID().withMessage("Invalid space ID"),
    body("startTime").isISO8601().withMessage("Valid start time required").toISOString(),
    body("endTime").isISO8601().withMessage("Valid end time required").toISOString(),
    body("vehicleId").optional().isUUID().withMessage("Invalid vehicle ID"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId, spaceId, startTime, endTime, vehicleId } = req.body;
      const userId = req.user?.id;

      // Validate facility exists
      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
      });

      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      // Validate space exists and belongs to facility
      const space = await prisma.parkingSpace.findUnique({
        where: { id: spaceId },
        include: { zone: true, floor: true },
      });

      if (!space || space.facilityId !== facilityId) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      // Check space availability with locking
      const availableSpace = await prisma.parkingSpace.findUnique({
        where: { id: spaceId },
        lock: { mode: "update" },
      });

      if (availableSpace.status !== "AVAILABLE" && availableSpace.status !== "RESERVED_HELD") {
        return next(createError(409, ErrorCodes.RESERVATION_CONFLICT));
      }

      // Validate time range
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (end <= start) {
        return next(createError(400, "End time must be after start time"));
      }

      if (start < new Date()) {
        return next(createError(400, "Start time must be in the future"));
      }

      // Check for overlapping reservations using transaction-safe query
      const overlapping = await prisma.reservation.count({
        where: {
          spaceId,
          status: "CONFIRMED",
          OR: [
            { startTime: { lt: end }, endTime: { gt: start } },
          ],
        },
      });

      if (overlapping > 0) {
        return next(createError(409, ErrorCodes.RESERVATION_CONFLICT));
      }

      // Calculate price
      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      const durationHours = Math.ceil(durationMinutes / 60);

      let pricePerHour = space.pricePerHour || facility.hourlyRate || 5000;
      let pricePerDay = space.pricePerDay || facility.dailyRate || 50000;

      let totalCents = 0;

      if (durationHours <= 24) {
        const hourlyCount = Math.ceil(durationHours);
        totalCents = hourlyCount * pricePerHour * 100;
      } else {
        const dailyCount = Math.ceil(durationHours / 24);
        totalCents = dailyCount * pricePerDay * 100;
      }

      // Ensure minimum charge
      if (totalCents < pricePerHour * 100) {
        totalCents = pricePerHour * 100;
      }

      // Create reservation
      const reservation = await prisma.reservation.create({
        data: {
          userId,
          spaceId,
          facilityId,
          startTime: start,
          endTime: end,
          status: "CONFIRMED",
          paymentStatus: "PENDING",
          priceCents: totalCents,
          currency: "UZS",
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          space: {
            include: {
              zone: { select: { name: true, zoneCode: true } },
              floor: true,
            },
          },
        },
      });

      // Mark space as RESERVED
      await prisma.parkingSpace.update({
        where: { id: spaceId },
        data: { status: "RESERVED" },
      });

      // Generate QR token for reservation
      const qrToken = generateQrToken();

      await prisma.QrCodeTicket.create({
        data: {
          qrToken,
          qrTokenHash: qrToken, // simplified - in production hash the token
          purpose: "reservation",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      });

      // Invalidate availability cache
      invalidateCache(`availability:${facilityId}`);

      res.status(201).json({
        success: true,
        data: {
          reservation,
          qrToken,
        },
        message: "Reservation created successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/reservations
 * @desc Get user's reservations
 * @access Private
 */
router.get(
  "/",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      const reservations = await prisma.reservation.findMany({
        where: { userId },
        include: {
          space: {
            include: {
              zone: true,
              floor: true,
            },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({
        success: true,
        data: reservations,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/reservations/:id
 * @desc Get reservation details
 * @access Private
 */
router.get(
  "/:id",
  [
    param("id").isUUID().withMessage("Invalid reservation ID"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = req.params.id;
      const userId = req.user?.id;

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          space: {
            include: {
              zone: {
                select: { name: true, zoneCode: true },
              },
              floor: true,
            },
          },
        },
      });

      if (!reservation) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      // Check authorization
      if (reservation.userId !== userId && req.user?.role !== "ADMIN") {
        return next(createError(403, ErrorMessages.FORBIDDEN_ACCESS));
      }

      res.json({
        success: true,
        data: reservation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/reservations/:id/cancel
 * @desc Cancel a reservation
 * @access Private
 */
router.post(
  "/:id/cancel",
  [
    param("id").isUUID().withMessage("Invalid reservation ID"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = req.params.id;
      const userId = req.user?.id;

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      // Check authorization
      if (reservation.userId !== userId && req.user?.role !== "ADMIN") {
        return next(createError(403, ErrorMessages.FORBIDDEN_ACCESS));
      }

      // Check if can cancel
      if (reservation.status === "CANCELLED" || reservation.status === "COMPLETED") {
        return next(createError(400, "Reservation cannot be cancelled - already cancelled or completed"));
      }

      const now = new Date();
      const timeDiff = reservation.startTime.getTime() - now.getTime();
      const hoursBeforeStart = timeDiff / (1000 * 60 * 60);

      if (hoursBeforeStart < 2 && reservation.paymentStatus === "COMPLETED") {
        return next(createError(400, "Cannot cancel reservation within 2 hours of start time after payment"));
      }

      // Update reservation status
      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          status: "CANCELLED",
          canceledAt: now,
        },
      });

      // Mark space as AVAILABLE again
      await prisma.parkingSpace.update({
        where: { id: reservation.spaceId },
        data: { status: "AVAILABLE" },
      });

      // Invalidate availability cache
      invalidateCache(`availability:${reservation.facilityId}`);

      res.json({
        success: true,
        data: updated,
        message: "Reservation cancelled successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;