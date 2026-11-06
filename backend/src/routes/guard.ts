import { Router, Request, Response, NextFunction } from "express";
import { body, query } from "express-validator";
import crypto from "crypto";
import { validate } from "../middleware/validation";
import { authenticate, authorize } from "../utils/jwt";
import { prisma } from "../utils/db";
import { createError, ErrorCodes, ErrorMessages } from "../utils/http-error";
import { emitAvailabilityForFacility, emitSpaceUpdated } from "../utils/realtime";

const router = Router();

const hashQrToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * @route POST /api/guard/entry
 * @desc Guard vehicle entry (walk-in). Space assignment is atomic.
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

      if (!vehicleId && !licensePlate) {
        return next(createError(400, "Either vehicleId or licensePlate is required"));
      }

      let resolvedFacilityId: string | undefined = facilityId;

      if (!resolvedFacilityId && zoneId) {
        const zone = await prisma.parkingZone.findUnique({
          where: { id: zoneId },
          select: { floor: { select: { facilityId: true } } },
        });
        if (!zone) {
          return next(createError(404, ErrorMessages.NOT_FOUND));
        }
        resolvedFacilityId = zone.floor.facilityId;
      }

      if (!resolvedFacilityId) {
        return next(createError(400, "facilityId or zoneId is required"));
      }

      const targetFacilityId: string = resolvedFacilityId;

      const facility = await prisma.parkingFacility.findUnique({
        where: { id: targetFacilityId },
        select: { id: true, hourlyRate: true, currency: true, status: true },
      });

      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }
      if (facility.status !== "ACTIVE") {
        return next(createError(400, "Facility is not accepting vehicles"));
      }

      const result = await prisma.$transaction(async (tx) => {
        let vehicle;

        if (vehicleId) {
          vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
          if (!vehicle) {
            throw createError(404, ErrorMessages.NOT_FOUND);
          }
        } else {
          vehicle = await tx.vehicle.upsert({
            where: { plateNumber: licensePlate },
            update: {},
            create: {
              plateNumber: licensePlate,
              plateRegion: "Tashkent",
              vehicleType: "car",
            },
          });
        }

        // Row-level lock; SKIP LOCKED keeps concurrent guards from taking the same space.
        const locked = zoneId
          ? await tx.$queryRaw<Array<{ id: string }>>`
              SELECT "id" FROM "ParkingSpace"
              WHERE "facilityId" = ${targetFacilityId}
                AND "zoneId" = ${zoneId}
                AND "status" = 'AVAILABLE'
              ORDER BY "spaceNumber" ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            `
          : await tx.$queryRaw<Array<{ id: string }>>`
              SELECT "id" FROM "ParkingSpace"
              WHERE "facilityId" = ${targetFacilityId}
                AND "status" = 'AVAILABLE'
              ORDER BY "floorId" ASC, "spaceNumber" ASC
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            `;

        if (locked.length === 0) {
          throw createError(ErrorCodes.CONFLICT, "No available parking space in this facility");
        }

        const space = await tx.parkingSpace.findUnique({ where: { id: locked[0].id } });

        if (!space) {
          throw createError(404, ErrorMessages.NOT_FOUND);
        }

        const now = new Date();
        const expectedExit = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        const pricePerHour = space.pricePerHour || facility.hourlyRate;
        const basePriceCents = Math.max(pricePerHour * 4 * 100, pricePerHour * 100);

        const session = await tx.parkingSession.create({
          data: {
            userId: null,
            vehicleId: vehicle.id,
            spaceId: space.id,
            facilityId: targetFacilityId as string,
            entryTime: now,
            expectedExit,
            status: "ACTIVE",
            basePriceCents,
            finalPriceCents: basePriceCents,
            currency: facility.currency || "UZS",
          },
        });

        const qrToken = crypto.randomBytes(32).toString("hex");

        await tx.qrCodeTicket.create({
          data: {
            qrToken,
            qrTokenHash: hashQrToken(qrToken),
            purpose: "entry",
            parkingSessionId: session.id,
            expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
            status: "ACTIVE",
          },
        });

        await tx.parkingSpace.update({
          where: { id: space.id },
          data: { status: "OCCUPIED" },
        });

        return { session, qrToken, space, basePriceCents, expectedExit };
      });

      emitSpaceUpdated({
        facilityId: targetFacilityId,
        spaceId: result.space.id,
        spaceNumber: result.space.spaceNumber,
        status: "OCCUPIED",
        previousStatus: "AVAILABLE",
        floorId: result.space.floorId,
        zoneId: result.space.zoneId,
        reason: "CHECK_IN",
      });
      await emitAvailabilityForFacility(targetFacilityId);

      res.json({
        success: true,
        data: {
          session: result.session,
          qrToken: result.qrToken,
          space: {
            id: result.space.id,
            spaceNumber: result.space.spaceNumber,
            zone: result.space.zoneName,
            floor: result.space.level,
          },
          estimatedPrice: result.basePriceCents,
          estimatedExit: result.expectedExit,
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
 * @desc Guard vehicle exit. Session is completed atomically.
 * @access Private - Guard
 */
router.post(
  "/exit",
  authenticate,
  authorize("GUARD"),
  [
    body("qrToken").optional().trim().notEmpty().withMessage("QR token cannot be empty"),
    body("licensePlate").optional().trim().notEmpty().withMessage("License plate cannot be empty"),
    body("spaceId").optional().isUUID().withMessage("Invalid space ID"),
    body("plateSearch").optional().trim().notEmpty().withMessage("License plate for search required"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { qrToken, licensePlate, spaceId, plateSearch } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        let ticket: { id: string; status: string; expiresAt: Date; parkingSessionId: string | null } | null = null;
        let sessionId: string | null = null;

        if (qrToken) {
          ticket = await tx.qrCodeTicket.findUnique({
            where: { qrToken },
            select: { id: true, status: true, expiresAt: true, parkingSessionId: true },
          });

          if (!ticket) {
            throw createError(400, ErrorMessages.QR_CODE_INVALID);
          }
          if (ticket.status === "USED") {
            throw createError(ErrorCodes.CONFLICT, ErrorMessages.QR_CODE_USED);
          }
          if (ticket.status === "REVOKED") {
            throw createError(403, "This QR ticket has been revoked");
          }
          if (ticket.status === "EXPIRED" || ticket.expiresAt < new Date()) {
            throw createError(ErrorCodes.CONFLICT, "QR ticket has expired");
          }
          if (!ticket.parkingSessionId) {
            throw createError(400, "QR ticket is not linked to a parking session");
          }
          sessionId = ticket.parkingSessionId;
        } else if (licensePlate || plateSearch) {
          const plate = licensePlate || plateSearch;
          const session = await tx.parkingSession.findFirst({
            where: { vehicle: { plateNumber: plate }, status: "ACTIVE" },
            select: { id: true },
            orderBy: { entryTime: "desc" },
          });
          if (!session) {
            throw createError(404, "No active parking session for this vehicle");
          }
          sessionId = session.id;
        } else if (spaceId) {
          const session = await tx.parkingSession.findFirst({
            where: { spaceId, status: "ACTIVE" },
            select: { id: true },
            orderBy: { entryTime: "desc" },
          });
          if (!session) {
            throw createError(404, "No active parking session for this space");
          }
          sessionId = session.id;
        } else {
          throw createError(400, "Either qrToken, licensePlate, plateSearch or spaceId is required");
        }

        // Lock the session so a double exit cannot double-charge.
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "ParkingSession"
          WHERE "id" = ${sessionId} AND "status" = 'ACTIVE'
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw createError(404, "Active parking session not found");
        }

        const session = await tx.parkingSession.findUnique({
          where: { id: sessionId as string },
          include: { space: true, facility: true },
        });

        if (!session) {
          throw createError(404, "Parking session not found");
        }

        if (ticket) {
          await tx.qrCodeTicket.update({
            where: { id: ticket.id },
            data: { status: "USED", usedAt: new Date() },
          });
        }

        const now = new Date();
        const durationMinutes = Math.max(
          1,
          Math.round((now.getTime() - session.entryTime.getTime()) / (1000 * 60))
        );
        const durationHours = Math.ceil(durationMinutes / 60);

        const pricePerHour = session.space.pricePerHour || session.facility.hourlyRate;
        const pricePerDay = session.space.pricePerDay || session.facility.dailyRate;

        let finalPriceCents =
          durationHours <= 24
            ? durationHours * pricePerHour * 100
            : Math.ceil(durationHours / 24) * pricePerDay * 100;

        if (durationHours <= 24 && pricePerDay > 0) {
          finalPriceCents = Math.min(finalPriceCents, pricePerDay * 100);
        }
        finalPriceCents = Math.max(finalPriceCents, pricePerHour * 100);

        const updatedSession = await tx.parkingSession.update({
          where: { id: session.id },
          data: {
            status: "COMPLETED",
            actualExitTime: now,
            durationMinutes,
            finalPriceCents,
          },
        });

        // A future confirmed reservation keeps the space reserved after checkout.
        const upcomingReservations = await tx.reservation.count({
          where: { spaceId: session.spaceId, status: "CONFIRMED", endTime: { gt: now } },
        });
        const nextStatus = upcomingReservations > 0 ? "RESERVED" : "AVAILABLE";

        await tx.parkingSpace.update({
          where: { id: session.spaceId },
          data: { status: nextStatus },
        });

        return {
          updatedSession,
          finalPriceCents,
          durationMinutes,
          nextStatus,
          space: session.space,
          facilityId: session.facilityId,
        };
      });

      emitSpaceUpdated({
        facilityId: result.facilityId,
        spaceId: result.space.id,
        spaceNumber: result.space.spaceNumber,
        status: result.nextStatus,
        previousStatus: "OCCUPIED",
        floorId: result.space.floorId,
        zoneId: result.space.zoneId,
        reason: "CHECK_OUT",
      });
      await emitAvailabilityForFacility(result.facilityId);

      res.json({
        success: true,
        data: {
          session: result.updatedSession,
          finalPriceCents: result.finalPriceCents,
          durationMinutes: result.durationMinutes,
          space: {
            id: result.space.id,
            spaceNumber: result.space.spaceNumber,
            status: result.nextStatus,
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
 * @desc Validate a QR ticket without consuming it
 * @access Private - Guard
 */
router.post(
  "/verify-qr",
  authenticate,
  authorize("GUARD"),
  [body("qrToken").trim().notEmpty().withMessage("QR token required")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { qrToken } = req.body;

      const ticket = await prisma.qrCodeTicket.findUnique({
        where: { qrToken },
        include: {
          parkingSession: {
            select: { id: true, status: true, spaceId: true, facilityId: true },
          },
        },
      });

      if (!ticket) {
        return next(createError(400, ErrorMessages.QR_CODE_INVALID));
      }
      if (ticket.status === "USED") {
        return next(createError(ErrorCodes.CONFLICT, ErrorMessages.QR_CODE_USED));
      }
      if (ticket.status === "REVOKED") {
        return next(createError(403, "This QR ticket has been revoked"));
      }
      if (ticket.status === "EXPIRED" || ticket.expiresAt < new Date()) {
        return next(createError(ErrorCodes.CONFLICT, "QR ticket has expired"));
      }

      res.json({
        success: true,
        data: {
          valid: true,
          purpose: ticket.purpose,
          parkingSessionId: ticket.parkingSessionId,
          sessionStatus: ticket.parkingSession?.status ?? null,
          facilityId: ticket.parkingSession?.facilityId ?? null,
          expiresAt: ticket.expiresAt,
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
 * @desc Active parking sessions, optionally filtered by facility
 * @access Private - Guard
 */
router.get(
  "/sessions",
  authenticate,
  authorize("GUARD"),
  [query("facilityId").optional().isUUID().withMessage("Invalid facility ID")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const facilityId = typeof req.query.facilityId === "string" ? req.query.facilityId : undefined;

      const sessions = await prisma.parkingSession.findMany({
        where: {
          status: "ACTIVE",
          ...(facilityId ? { facilityId } : {}),
        },
        include: {
          space: {
            select: {
              id: true,
              spaceNumber: true,
              level: true,
              zoneName: true,
            },
          },
          vehicle: true,
          facility: { select: { id: true, name: true } },
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
