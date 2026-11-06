import { Router, Request, Response, NextFunction } from "express";
import { body, param } from "express-validator";
import crypto from "crypto";
import { validate } from "../middleware/validation";
import { authenticate } from "../utils/jwt";
import { prisma } from "../utils/db";
import { createError, ErrorCodes, ErrorMessages } from "../utils/http-error";
import { emitAvailabilityForFacility, emitSpaceUpdated } from "../utils/realtime";

const router = Router();

/** Cryptographically secure one-time QR token. */
const generateQrToken = (): string => crypto.randomBytes(32).toString("hex");
const hashQrToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const MAX_RESERVATION_DAYS = 30;

/**
 * @route POST /api/reservations
 * @desc Create a new reservation (row-locked, transaction-safe)
 * @access Private
 */
router.post(
  "/",
  authenticate,
  [
    body("facilityId").isUUID().withMessage("Invalid facility ID"),
    body("spaceId").isUUID().withMessage("Invalid space ID"),
    body("startTime").isISO8601().withMessage("Valid start time required"),
    body("endTime").isISO8601().withMessage("Valid end time required"),
    body("vehicleId").optional().isUUID().withMessage("Invalid vehicle ID"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { facilityId, spaceId, startTime, endTime } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return next(createError(401, ErrorMessages.UNAUTHORIZED_ACCESS));
      }

      const start = new Date(startTime);
      const end = new Date(endTime);
      const now = new Date();

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return next(createError(400, "Invalid start or end time"));
      }
      if (end <= start) {
        return next(createError(400, "End time must be after start time"));
      }
      if (start < now) {
        return next(createError(400, "Start time must be in the future"));
      }
      if (start.getTime() - now.getTime() > MAX_RESERVATION_DAYS * 24 * 60 * 60 * 1000) {
        return next(createError(400, `Reservations may only be made ${MAX_RESERVATION_DAYS} days ahead`));
      }

      const facility = await prisma.parkingFacility.findUnique({
        where: { id: facilityId },
        select: { id: true, status: true, hourlyRate: true, dailyRate: true },
      });

      if (!facility) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }
      if (facility.status !== "ACTIVE") {
        return next(createError(400, "Facility is not accepting reservations"));
      }

      const result = await prisma.$transaction(async (tx) => {
        // Row-level lock prevents two concurrent reservations for the same space.
        const lockedSpaces = await tx.$queryRaw<
          Array<{ id: string; status: string; pricePerHour: number; pricePerDay: number }>
        >`
          SELECT "id", "status", "pricePerHour", "pricePerDay"
          FROM "ParkingSpace"
          WHERE "id" = ${spaceId} AND "facilityId" = ${facilityId}
          FOR UPDATE
        `;

        if (lockedSpaces.length === 0) {
          throw createError(404, ErrorMessages.NOT_FOUND);
        }

        const space = lockedSpaces[0];

        if (space.status !== "AVAILABLE" && space.status !== "RESERVED_HELD") {
          throw createError(ErrorCodes.CONFLICT, ErrorMessages.RESERVATION_CONFLICT);
        }

        const overlapping = await tx.reservation.count({
          where: {
            spaceId,
            status: "CONFIRMED",
            startTime: { lt: end },
            endTime: { gt: start },
          },
        });

        if (overlapping > 0) {
          throw createError(ErrorCodes.CONFLICT, ErrorMessages.RESERVATION_CONFLICT);
        }

        const durationHours = Math.max(
          1,
          Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60))
        );

        const pricePerHour = space.pricePerHour || facility.hourlyRate;
        const pricePerDay = space.pricePerDay || facility.dailyRate;

        let totalCents =
          durationHours <= 24
            ? durationHours * pricePerHour * 100
            : Math.ceil(durationHours / 24) * pricePerDay * 100;

        // Daily cap and minimum one-hour charge.
        if (durationHours <= 24 && pricePerDay > 0) {
          totalCents = Math.min(totalCents, pricePerDay * 100);
        }
        totalCents = Math.max(totalCents, pricePerHour * 100);

        const reservation = await tx.reservation.create({
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
            space: {
              select: {
                id: true,
                spaceNumber: true,
                spaceType: true,
                zoneName: true,
                level: true,
              },
            },
          },
        });

        await tx.parkingSpace.update({
          where: { id: spaceId },
          data: { status: "RESERVED" },
        });

        const qrToken = generateQrToken();

        await tx.qrCodeTicket.create({
          data: {
            userId,
            qrToken,
            qrTokenHash: hashQrToken(qrToken),
            purpose: "reservation",
            expiresAt: new Date(end.getTime()),
            status: "ACTIVE",
          },
        });

        return { reservation, qrToken, previousStatus: space.status };
      });

      // Emit only after the transaction committed.
      emitSpaceUpdated({
        facilityId,
        spaceId,
        spaceNumber: result.reservation.space.spaceNumber,
        status: "RESERVED",
        previousStatus: result.previousStatus,
        floorId: undefined,
        zoneId: null,
        reason: "RESERVATION_CREATED",
      });
      await emitAvailabilityForFacility(facilityId);

      res.status(201).json({
        success: true,
        data: {
          reservation: result.reservation,
          qrToken: result.qrToken,
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
 * @desc Get the current user's reservations
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
            select: {
              id: true,
              spaceNumber: true,
              spaceType: true,
              zoneName: true,
              level: true,
            },
          },
          facility: {
            select: { id: true, name: true, address: true, city: true },
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
 * @desc Get reservation details (owner or admin)
 * @access Private
 */
router.get(
  "/:id",
  authenticate,
  [param("id").isUUID().withMessage("Invalid reservation ID")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = String(req.params.id);
      const userId = req.user?.id;

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          space: {
            select: {
              id: true,
              spaceNumber: true,
              spaceType: true,
              zoneName: true,
              level: true,
            },
          },
          facility: {
            select: { id: true, name: true, address: true, city: true },
          },
        },
      });

      if (!reservation) {
        return next(createError(404, ErrorMessages.NOT_FOUND));
      }

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
 * @desc Cancel a reservation (owner or admin)
 * @access Private
 */
router.post(
  "/:id/cancel",
  authenticate,
  [param("id").isUUID().withMessage("Invalid reservation ID")],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = String(req.params.id);
      const userId = req.user?.id;

      const result = await prisma.$transaction(async (tx) => {
        const reservation = await tx.reservation.findUnique({
          where: { id: reservationId },
        });

        if (!reservation) {
          throw createError(404, ErrorMessages.NOT_FOUND);
        }
        if (reservation.userId !== userId && req.user?.role !== "ADMIN") {
          throw createError(403, ErrorMessages.FORBIDDEN_ACCESS);
        }
        if (reservation.status === "CANCELLED" || reservation.status === "COMPLETED" || reservation.status === "EXPIRED") {
          throw createError(400, "Reservation cannot be cancelled");
        }

        const now = new Date();
        const hoursBeforeStart = (reservation.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursBeforeStart < 2 && reservation.paymentStatus === "COMPLETED") {
          throw createError(
            400,
            "Cannot cancel a paid reservation within 2 hours of the start time"
          );
        }

        // Lock the space row before changing its status.
        await tx.$queryRaw`SELECT "id" FROM "ParkingSpace" WHERE "id" = ${reservation.spaceId} FOR UPDATE`;

        const updated = await tx.reservation.update({
          where: { id: reservationId },
          data: { status: "CANCELLED", canceledAt: now },
        });

        const [futureReservations, activeSessions] = await Promise.all([
          tx.reservation.count({
            where: { spaceId: reservation.spaceId, status: "CONFIRMED", endTime: { gt: now } },
          }),
          tx.parkingSession.count({
            where: { spaceId: reservation.spaceId, status: "ACTIVE" },
          }),
        ]);

        const nextStatus =
          activeSessions > 0 ? "OCCUPIED" : futureReservations > 0 ? "RESERVED" : "AVAILABLE";

        const space = await tx.parkingSpace.update({
          where: { id: reservation.spaceId },
          data: { status: nextStatus },
        });

        return {
          updated,
          nextStatus,
          spaceNumber: space.spaceNumber,
          facilityId: reservation.facilityId,
          previousStatus: reservation.spaceId ? "RESERVED" : undefined,
        };
      });

      emitSpaceUpdated({
        facilityId: result.facilityId,
        spaceId: result.updated.spaceId,
        spaceNumber: result.spaceNumber,
        status: result.nextStatus,
        previousStatus: "RESERVED",
        reason: "RESERVATION_CANCELLED",
      });
      await emitAvailabilityForFacility(result.facilityId);

      res.json({
        success: true,
        data: result.updated,
        message: "Reservation cancelled successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
