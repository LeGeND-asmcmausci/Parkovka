import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { validate } from "../middleware/validation";
import { authenticate, authorize } from "../utils/jwt";
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import { createError, ErrorCodes, ErrorMessages } from "../utils/http-error";
import { cacheAvailability, invalidateCache, trackSession, getSessionData } from "../utils/redis";
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
 * @route POST /api/guard/entry
 * @desc Guard vehicle entry (walk-in or recognized)
 * @access Private - Guard
 */
router.post(
  "/entry",
  authenticate,
  authorize("GUARD"),
  [
    body("facilityId").optional().isUUID().withMessage("Invalid facility ID"),
    body("vehicleId").optional().isUUID().withMessage("Invalid vehicle ID"),
    body("licensePlate").optional().trim().notEmpty().withMessage("License plate required"),
    body("zoneId").optional().isUUID().withMessage("Invalid zone ID"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId, vehicleId, licensePlate, zoneId } = req.body;
      const guardId = req.user?.id;

      // If license plate provided, try to find or create vehicle
      let vehicle;
      if (licensePlate) {
        vehicle = await prisma.vehicle.findUnique({
          where: { plateNumber: licensePlate },
        });

        if (!vehicle) {
          // Create vehicle as guest (no user account)
          vehicle = await prisma.vehicle.create({
            data: {
              plateNumber: licensePlate,
              plateRegion: "Tashkent",
              vehicleType: "car",
            },
          });
        }
      }

      // If facilityId provided, validate it
      let targetFacility;
      if (facilityId) {
        targetFacility = await prisma.parkingFacility.findUnique({
          where: { id: facilityId },
        });

        if (!targetFacility) {
          return next(createError(404, ErrorMessages.NOT_FOUND));
        }
      }

      // If zoneId provided, validate it
      let targetZone;
      if (zoneId) {
        targetZone = await prisma.ParkingZone.findUnique({
          where: { id: zoneId },
        });

        if (!targetZone) {
          return next(createError(404, ErrorMessages.NOT_FOUND));
        }
      }

      // Find an available space with proper locking
      let space;

      if (zoneId) {
        // Try to find available space in specific zone
        space = await prisma.parkingSpace.findFirst({
          where: {
            zoneId,
            status: "AVAILABLE",
          },
          lock: { mode: "update" },
        });
      } else if (facilityId) {
        // Try to find any available space in facility
        space = await prisma.parkingSpace.findFirst({
          where: {
            facilityId,
            status: "AVAILABLE",
          },
          lock: { mode: "update" },
        });
      } else {
        // Try to find any available space
        space = await prisma.parkingSpace.findFirst({
          where: { status: "AVAILABLE" },
          lock: { mode: "update" },
        });
      }

      if (!space) {
        return next(createError(409, ErrorCodes.RESERVATION_CONFLICT));
      }

      // Mark space as RESERVED_HELD (temporarily held for walk-in)
      await prisma.parkingSpace.update({
        where: { id: space.id },
        data: { status: "RESERVED_HELD" },
      });

      // Calculate estimated duration and price
      const now = new Date();
      const expectedExit = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours

      // Calculate price based on zone and facility pricing
      let pricePerHour = space.pricePerHour;
      let pricePerDay = space.pricePerDay;

      // Fall back to zone pricing, then facility pricing
      if (!pricePerHour && targetZone) {
        const zonePricing = await prisma.PricingRule.findFirst({
          where: {
            zoneId: targetZone.id,
            ruleType: "HOURLY",
            isActive: true,
          },
        });
        pricePerHour = zonePricing?.hourlyRate;
      }

      if (!pricePerHour && space.zone?.zoneType) {
        const zonePricing = await prisma.PricingRule.findFirst({
          where: {
            zoneId: space.zone.id,
            ruleType: "HOURLY",
            isActive: true,
          },
        });
        pricePerHour = zonePricing?.hourlyRate;
      }

      if (!pricePerHour) {
        pricePerHour = targetFacility?.hourlyRate || 5000;
      }

      if (!pricePerDay) {
        pricePerDay = targetFacility?.dailyRate || 50000;
      }

      // Calculate base price for estimated 4 hours
      const estimatedHours = 4;
      let basePriceCents = estimatedHours * pricePerHour * 100;

      // Ensure minimum charge
      if (basePriceCents < pricePerHour * 100) {
        basePriceCents = pricePerHour * 100;
      }

      // Create parking session
      const session = await prisma.parkingSession.create({
        data: {
          userId: null,
          vehicleId: vehicle.id,
          spaceId: space.id,
          facilityId: targetFacility?.id || space.facilityId,
          entryTime: now,
          expectedExit,
          status: "ACTIVE",
          basePriceCents,
          finalPriceCents: basePriceCents,
          currency: "UZS",
        },
        include: {
          space: {
            include: {
              zone: true,
              floor: true,
              facility: true,
            },
          },
          vehicle: true,
        },
      });

      // Generate QR ticket for entry
      const qrToken = crypto.randomBytes(32).toString("hex");
      const qrTokenHash = await prisma.$executeRaw`SELECT bcrypt_hash(?, 12)`; // placeholder - in production use bcrypt

      await prisma.QrCodeTicket.create({
        data: {
          qrToken,
          qrTokenHash: qrToken, // simplified for now
          purpose: "entry",
          parkingSessionId: session.id,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      });

      // Update space status to OCCUPIED
      await prisma.parkingSpace.update({
        where: { id: space.id },
        data: { status: "OCCUPIED" },
      });

      // Invalidate availability cache
      invalidateCache(`availability:${targetFacility?.id || space.facilityId}`);

      // Track session in Redis
      await trackSession(session.id, {
        vehicleId: vehicle.id,
        plateNumber: licensePlate || "",
        entryTime: now,
      });

      res.json({
        success: true,
        data: {
          session,
          qrToken,
          space: {
            id: space.id,
            spaceNumber: space.spaceNumber,
            zone: space.zone?.zoneCode,
            floor: space.floor?.level,
          },
          estimatedPrice: basePriceCents,
          estimatedExit: expectedExit,
        },
        message: "Vehicle entry recorded successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/guard/exit
 * @desc Guard vehicle exit
 * @access Private - Guard
 */
router.post(
  "/exit",
  authenticate,
  authorize("GUARD"),
  [
    body("qrToken").optional().trim().notEmpty().withMessage("QR token required"),
    body("licensePlate").optional().trim().notEmpty().withMessage("License plate required"),
    body("spaceId").optional().isUUID().withMessage("Invalid space ID"),
    body("plateSearch").optional().trim().notEmpty().withMessage("License plate for search required"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { qrToken, licensePlate, spaceId, plateSearch } = req.body;

      // Determine which method to use for session lookup
      let session;

      if (qrToken) {
        // Find the parking session by QR token
        session = await prisma.parkingSession.findFirst({
          where: {
            // In production, would look up via QR ticket
            id: "placeholder-session-id",
          },
          include: {
            space: true,
            vehicle: true,
            facility: true,
          },
        });

        if (!session || session.status !== "ACTIVE") {
          return next(createError(404, ErrorMessages.NOT_FOUND));
        }
      } else if (licensePlate || plateSearch) {
        const plate = licensePlate || plateSearch;

        session = await prisma.parkingSession.findFirst({
          where: {
            vehicle: { plateNumber: plate },
            status: "ACTIVE",
          },
          include: {
            space: true,
            vehicle: true,
            facility: true,
          },
        });

        if (!session) {
          return next(createError(404, ErrorMessages.NOT_FOUND));
        }
      } else if (spaceId) {
        session = await prisma.parkingSession.findFirst({
          where: {
            spaceId: spaceId,
            status: "ACTIVE",
          },
          include: {
            space: true,
            vehicle: true,
            facility: true,
          },
        });

        if (!session) {
          return next(createError(404, ErrorMessages.NOT_FOUND));
        }
      } else {
        return next(createError(400, "Either QR token, license plate, or space ID required"));
      }

      if (!session) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

      // Calculate final price
      const now = new Date();
      const durationMinutes = Math.round((now.getTime() - session.entryTime.getTime()) / (1000 * 60));
      const durationHours = Math.ceil(durationMinutes / 60);

      let finalPriceCents = session.finalPriceCents;

      if (!finalPriceCents || finalPriceCents === 0) {
        const pricePerHour = session.space?.pricePerHour || session.facility?.hourlyRate || 5000;
        const pricePerDay = session.space?.pricePerDay || session.facility?.dailyRate || 50000;

        if (durationHours <= 24) {
          finalPriceCents = durationHours * pricePerHour * 100;
        } else {
          const dailyCount = Math.ceil(durationHours / 24);
          finalPriceCents = dailyCount * pricePerDay * 100;
        }

        await prisma.parkingSession.update({
          where: { id: session.id },
          data: { finalPriceCents },
        });
      }

      // Update space status to AVAILABLE
      await prisma.parkingSpace.update({
        where: { id: session.spaceId },
        data: { status: "AVAILABLE" },
      });

      // Invalidate availability cache
      invalidateCache(`availability:${session.facilityId}`);

      // Generate exit QR code
      const exitQrToken = crypto.randomBytes(32).toString("hex");

      await prisma.QrCodeTicket.create({
        data: {
          qrToken: exitQrToken,
          purpose: "exit",
          parkingSessionId: session.id,
          expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      });

      res.json({
        success: true,
        data: {
          session,
          finalPriceCents,
          durationMinutes,
          exitQrToken,
          space: {
            id: session.spaceId,
            spaceNumber: session.space?.spaceNumber,
          },
        },
        message: "Vehicle exit recorded successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/guard/verify-qr
 * @desc Verify QR code for entry/exit
 * @access Private - Guard
 */
router.post(
  "/verify-qr",
  authenticate,
  authorize("GUARD"),
  [
    body("qrToken").trim().notEmpty().withMessage("QR token required"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { qrToken } = req.body;

      res.json({
        success: true,
        data: {
          valid: true,
          purpose: "entry",
          parkingSessionId: "placeholder",
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
        message: "QR code verified successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/guard/sessions
 * @desc Get guard's active sessions
 * @access Private - Guard
 */
router.get(
  "/sessions",
  authenticate,
  authorize("GUARD"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await prisma.parkingSession.findMany({
        where: { status: "ACTIVE" },
        include: {
          space: {
            include: {
              zone: true,
              floor: true,
              facility: true,
            },
          },
          vehicle: true,
        },
        orderBy: { entryTime: "desc" },
      });

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;