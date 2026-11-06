import { Router, Request, Response } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validation";
import { authenticate } from "../utils/jwt";
import { prisma } from "../utils/db";
import { createError, ErrorMessages } from "../utils/http-error";
import { authenticateCallback } from "../utils/payment-security";
import { completePaymentOnce, failPaymentOnce } from "../utils/payment-completion";

const router = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

const rawBodyOf = (req: Request): string | undefined => {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  return raw ? raw.toString("utf8") : undefined;
};

const findPayment = async (paymentId: unknown, providerTxId: unknown) => {
  if (isUuid(paymentId)) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (payment) return payment;
  }

  if (typeof providerTxId === "string" && providerTxId.length > 0) {
    return prisma.payment.findFirst({ where: { providerTxId } });
  }

  return null;
};

/**
 * @route POST /api/payments
 * @desc Initiate payment for reservation or session
 * @access Private
 */
router.post(
  "/",
  authenticate,
  [
    body("reservationId").optional().isUUID().withMessage("Invalid reservation ID"),
    body("sessionId").optional().isUUID().withMessage("Invalid session ID"),
    body("amount").optional().isInt({ min: 1 }).withMessage("Amount must be positive"),
    body("paymentMethod")
      .isIn(["CLICK", "PAYME", "CASH"])
      .withMessage("Invalid payment method"),
    body("description").optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next) => {
    try {
      const { reservationId, sessionId, amount, paymentMethod, description } = req.body;
      const userId = req.user?.id;

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

      const finalAmount =
        amount ||
        ("priceCents" in paymentTarget ? paymentTarget.priceCents : paymentTarget.finalPriceCents) ||
        0;

      if (finalAmount <= 0) {
        return next(createError(400, "Amount must be greater than zero"));
      }

      const payment = await prisma.payment.create({
        data: {
          userId,
          ...(targetType === "reservation"
            ? { reservationId: paymentTarget.id }
            : { parkingSessionId: paymentTarget.id }),
          amountCents: finalAmount,
          currency: "UZS",
          paymentMethod,
          status: "PENDING",
          provider: paymentMethod === "CASH" ? "cash" : paymentMethod.toLowerCase(),
          description: description || `Parking payment for ${targetType}`,
        },
      });

      res.json({
        success: true,
        data: {
          paymentId: payment.id,
          amount: finalAmount,
          currency: "UZS",
          paymentMethod,
          status: "PENDING",
          providerUrl: `/api/payments/${paymentMethod}/init`,
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
 * @desc Click Prepare/Complete callback (signature required)
 * @access Public (payment provider callback)
 *
 * `amount` is expressed in UZS by Click and must match the stored amount exactly
 * (converted to integer tiyin internally).
 */
router.post("/click/callback", async (req: Request, res: Response, next) => {
  try {
    const payload = (req.body ?? {}) as Record<string, unknown>;

    const auth = authenticateCallback("click", {
      rawBody: rawBodyOf(req),
      testSignature: req.header("x-test-signature") ?? undefined,
      clickBody: payload,
    });

    if (!auth.ok) {
      return res.status(auth.status ?? 503).json({
        success: false,
        error: -1,
        error_note: auth.message ?? "Payment callback rejected",
      });
    }

    const clickTransId = String(payload.click_trans_id ?? payload.transactionId ?? "");
    const merchantTransId = String(payload.merchant_trans_id ?? payload.paymentId ?? "");
    const action = Number(payload.action ?? 1);

    if (!clickTransId || !merchantTransId) {
      return res.status(400).json({
        success: false,
        error: -8,
        error_note: "Invalid callback data",
      });
    }

    const payment = await findPayment(merchantTransId, clickTransId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: -5,
        error_note: "Payment not found",
      });
    }

    // action=0 -> prepare
    if (action === 0) {
      if (payment.providerTxId !== clickTransId && payment.status !== "COMPLETED") {
        await prisma.payment.updateMany({
          where: {
            id: payment.id,
            OR: [{ providerTxId: null }, { providerTxId: clickTransId }],
          },
          data: { providerTxId: clickTransId, provider: "click" },
        });
      }

      return res.json({
        success: true,
        error: 0,
        error_note: "Success",
        data: { paymentId: payment.id, status: payment.status, action: 0 },
      });
    }

    const amountUzs = Number(payload.amount);
    if (!Number.isFinite(amountUzs)) {
      return res.status(400).json({
        success: false,
        error: -2,
        error_note: "Incorrect amount",
      });
    }

    const result = await completePaymentOnce({
      paymentId: payment.id,
      providerTxId: clickTransId,
      provider: "click",
      amountCents: Math.round(amountUzs * 100),
    });

    if (result.result === "amount_mismatch") {
      return res.status(400).json({
        success: false,
        error: -2,
        error_note: "Incorrect amount",
      });
    }

    if (result.result === "not_found") {
      return res.status(404).json({
        success: false,
        error: -5,
        error_note: "Payment not found",
      });
    }

    if (result.result === "invalid_state") {
      return res.status(409).json({
        success: false,
        error: -4,
        error_note: "Payment state conflict",
      });
    }

    res.json({
      success: true,
      error: 0,
      error_note: result.result === "already_completed" ? "Already paid" : "Success",
      data: {
        paymentId: payment.id,
        status: "COMPLETED",
        action: 1,
        idempotent: result.result === "already_completed",
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/payments/payme/callback
 * @desc Payme JSON-RPC callback (Basic auth required)
 * @access Public (payment provider callback)
 *
 * `amount` is expressed in tiyin by Payme and must match `amountCents`.
 */
router.post("/payme/callback", async (req: Request, res: Response, next) => {
  const rpcId = (req.body as { id?: unknown })?.id ?? null;
  const reply = (payload: Record<string, unknown>, status = 200) =>
    res.status(status).json({ jsonrpc: "2.0", id: rpcId, ...payload });
  const rpcError = (code: number, message: string, status = 200) =>
    reply({ error: { code, message } }, status);

  try {
    const auth = authenticateCallback("payme", {
      rawBody: rawBodyOf(req),
      testSignature: req.header("x-test-signature") ?? undefined,
      paymeAuthHeader: req.header("authorization") ?? undefined,
    });

    if (!auth.ok) {
      return rpcError(-32504, auth.message ?? "Unauthorized", auth.status ?? 401);
    }

    const method = (req.body as { method?: string })?.method;
    const params = ((req.body as { params?: Record<string, any> })?.params ??
      {}) as Record<string, any>;
    const paymentId = params?.account?.payment_id;
    const transactionId = params?.id !== undefined ? String(params.id) : "";

    switch (method) {
      case "CheckPerformTransaction": {
        const payment = await findPayment(paymentId, transactionId);
        if (!payment) return rpcError(-31050, "Payment not found");
        if (
          !Number.isFinite(Number(params.amount)) ||
          Number(params.amount) !== payment.amountCents
        ) {
          return rpcError(-31001, "Incorrect amount");
        }
        if (payment.status === "COMPLETED") {
          return reply({ result: { allow: false, detail: { status: "COMPLETED" } } });
        }
        return reply({ result: { allow: true } });
      }

      case "CreateTransaction": {
        if (!transactionId) return rpcError(-32600, "Invalid transaction id");
        const payment = await findPayment(paymentId, transactionId);
        if (!payment) return rpcError(-31050, "Payment not found");
        if (
          !Number.isFinite(Number(params.amount)) ||
          Number(params.amount) !== payment.amountCents
        ) {
          return rpcError(-31001, "Incorrect amount");
        }
        if (payment.providerTxId && payment.providerTxId !== transactionId) {
          return rpcError(-31008, "Transaction already exists");
        }
        if (payment.status === "REFUNDED") {
          return rpcError(-31008, "Payment is refunded");
        }

        if (!payment.providerTxId) {
          await prisma.payment.updateMany({
            where: {
              id: payment.id,
              OR: [{ providerTxId: null }, { providerTxId: transactionId }],
            },
            data: { providerTxId: transactionId, provider: "payme" },
          });
        }

        return reply({
          result: {
            create_time: payment.createdAt.getTime(),
            transaction: transactionId,
            state: payment.status === "COMPLETED" ? 2 : 1,
          },
        });
      }

      case "PerformTransaction": {
        if (!transactionId) return rpcError(-32600, "Invalid transaction id");
        const payment = await findPayment(paymentId, transactionId);
        if (!payment) return rpcError(-31050, "Payment not found");

        const result = await completePaymentOnce({
          paymentId: payment.id,
          providerTxId: transactionId,
          provider: "payme",
          amountCents: Number.isFinite(Number(params.amount))
            ? Number(params.amount)
            : undefined,
        });

        if (result.result === "amount_mismatch") return rpcError(-31001, "Incorrect amount");
        if (result.result === "not_found") return rpcError(-31050, "Payment not found");
        if (result.result === "invalid_state") return rpcError(-31008, "Payment state conflict");

        return reply({
          result: {
            perform_time: (result.paidAt ?? new Date()).getTime(),
            transaction: transactionId,
            state: 2,
          },
        });
      }

      case "CancelTransaction": {
        if (!transactionId) return rpcError(-32600, "Invalid transaction id");
        const payment = await findPayment(paymentId, transactionId);
        if (!payment) return rpcError(-31050, "Payment not found");

        const outcome = await failPaymentOnce({
          paymentId: payment.id,
          providerTxId: transactionId,
          provider: "payme",
          reason:
            typeof params.reason === "number"
              ? `Canceled by provider (${params.reason})`
              : "Canceled by provider",
        });

        if (outcome === "already_completed") {
          return rpcError(-31007, "Cannot cancel a completed transaction");
        }

        return reply({
          result: { cancel_time: Date.now(), transaction: transactionId, state: -2 },
        });
      }

      default:
        return rpcError(-32601, "Method not found");
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/payments
 * @desc Get user's payments
 * @access Private
 */
router.get("/", authenticate, async (req: Request, res: Response, next) => {
  try {
    const userId = req.user?.id;

    const payments = await prisma.payment.findMany({
      where: { userId },
      include: {
        reservation: { select: { id: true, status: true, startTime: true } },
        parkingSession: { select: { id: true, status: true, entryTime: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
});

export default router;
