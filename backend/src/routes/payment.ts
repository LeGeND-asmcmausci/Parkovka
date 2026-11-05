import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import { validate } from "../middleware/validation";
import { authenticate, authorize } from "../utils/jwt";
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import { createError, ErrorCodes, ErrorMessages } from "../utils/http-error";
import { cacheAvailability, invalidateRateLimit } from "../utils/redis";
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
 * @route POST /api/payments
 * @ Initiate payment for reservation or session
 * @access Private
 */
router.post(
  "/",
  authenticate,
  [
    body("reservationId").optional().isUUID().withMessage("Invalid reservation ID"),
    body("sessionId").optional().isUUID().withMessage("Invalid session ID"),
    body("amount").optional().isInt({ min: 1 }).withMessage("Amount must be positive"),
    body("paymentMethod").isIn(["CLICK", "PAYME", "CASH"]).withMessage("Invalid payment method"),
    body("description").optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reservationId, sessionId, amount, paymentMethod, description } = req.body;
      const userId = req.user?.id;

      // Determine what we're paying for
      let paymentTarget;
      let targetType: "reservation" | "session" = "reservation";

      if (reservationId) {
        paymentTarget = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: { user: true, space: true, facility: true },
        });

        if (!paymentTarget) {
          return next(createError(404, ErrorMessages.NOT_FOUND));
        }

        // Check authorization - user can only pay for their own reservations
        if (paymentTarget.userId !== userId && req.user?.role !== "ADMIN") {
          return next(createError(403, ErrorMessages.FORBIDDEN_ACCESS));
        }

        if (paymentTarget.paymentStatus === "COMPLETED") {
          return next(createError(400, "Reservation already paid"));
        }

        targetType = "reservation";
      } else if (sessionId) {
        paymentTarget = await prisma.parkingSession.findUnique({
          where: { id: sessionId },
          include: { user: true, space: true, facility: true },
        });

        if (!paymentTarget) {
          return next(createError(404, ErrorMessages.NOT_FOUND));
        }

        targetType = "session";
      } else {
        return next(createError(400, "Either reservationId or sessionId required"));
      }

      // Use the session/reservation price if amount not specified
      const finalAmount = amount || paymentTarget.priceCents || 0;

      if (finalAmount <= 0) {
        return next(createError(400, "Amount must be greater than zero"));
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          userId,
          [targetType === "reservation" ? "reservationId" : "parkingSessionId"]: paymentTarget.id,
          amountCents: finalAmount,
          currency: "UZS",
          paymentMethod,
          status: "PENDING",
          description: description || `Parking payment for ${targetType}`,
        },
      });

      // In a real implementation, here we would:
      // 1. Redirect to payment provider (Click/Payme)
      // 2. Or generate payment QR/code
      // 3. Return payment URL or init data

      // For now, simulate payment initiation
      res.json({
        success: true,
        data: {
          paymentId: payment.id,
          amount: finalAmount,
          currency: "UZS",
          paymentMethod,
          status: "PENDING",
          providerUrl: `/api/payments/${paymentMethod}/init`, // Placeholder
        },
        message: "Payment initiation started",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/payments/click/callback
 * @desc Click payment callback endpoint
 * @access Public (payment provider callback)
 */
router.post(
  "/click/callback",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { transactionId, status, amount, signature } = req.body;

      // Validate Click signature (in production, verify against Click's public key)
      // For now, accept and verify payment status

      if (!transactionId || !status) {
        return res.status(400).json({
          success: false,
          message: "Invalid callback data",
        });
      }

      // Find payment by provider transaction ID
      const payment = await prisma.payment.findFirst({
        where: { providerTxId: transactionId },
        include: {
          reservation: true,
          parkingSession: true,
        },
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      // Check if already processed (idempotency)
      if (payment.status === "COMPLETED") {
        return res.status(200).json({
          success: true,
          message: "Payment already processed",
        });
      }

      // Update payment status
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: status === "success" ? "COMPLETED" : "FAILED",
          providerTxId: transactionId,
          paidAt: new Date(),
          failureReason: status === "failure" ? "Payment declined" : undefined,
        },
      });

      // If payment completed, update related reservation/session
      if (updatedPayment.status === "COMPLETED") {
        if (payment.reservation) {
          await prisma.reservation.update({
            where: { id: payment.reservationId },
            data: { paymentStatus: "COMPLETED" },
          });
        }

        if (payment.parkingSession) {
          await prisma.parkingSession.update({
            where: { id: payment.parkingSessionId },
            data: { 
              status: "COMPLETED",
              finalPriceCents: payment.amountCents,
            },
          });
        }
      }

      res.json({
        success: true,
        data: updatedPayment,
        message: "Payment callback processed successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/payments/payme/callback
 * @desc Payme payment callback endpoint
 * @access Public (payment provider callback)
 */
router.post(
  "/payme/callback",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { merchantTxId, status, amount, sign } = req.body;

      // Validate Payme signature (in production, verify against Payme's public key)
      // For now, accept and verify payment status

      if (!merchantTxId || !status) {
        return res.status(400).json({
          success: false,
          message: "Invalid callback data",
        });
      }

      // Find payment by provider transaction ID
      const payment = await prisma.payment.findFirst({
        where: { providerTxId: merchantTxId },
        include: {
          reservation: true,
          parkingSession: true,
        },
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      // Check if already processed (idempotency)
      if (payment.status === "COMPLETED") {
        return res.status(200).json({
          success: true,
          message: "Payment already processed",
        });
      }

      // Update payment status
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: status === "success" ? "COMPLETED" : "FAILED",
          providerTxId: merchantTxId,
          paidAt: new Date(),
          failureReason: status === "failure" ? "Payment declined" : undefined,
        },
      });

      // If payment completed, update related reservation/session
      if (updatedPayment.status === "COMPLETED") {
        if (payment.reservation) {
          await prisma.reservation.update({
            where: { id: payment.reservationId },
            data: { paymentStatus: "COMPLETED" },
          });
        }

        if (payment.parkingSession) {
          await prisma.parkingSession.update({
            where: { id: payment.parkingSessionId },
            data: { 
              status: "COMPLETED",
              finalPriceCents: payment.amountCents,
            },
          });
        }
      }

      res.json({
        success: true,
        data: updatedPayment,
        message: "Payment callback processed successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/payments
 * @desc Get user's payments
 * @access Private
 */
router.get(
  "/",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      const payments = await prisma.payment.findMany({
        where: { userId },
        include: {
          reservation: {
            select: { id: true, status: true, startTime: true },
          },
          parkingSession: {
            select: { id: true, status: true, entryTime: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;