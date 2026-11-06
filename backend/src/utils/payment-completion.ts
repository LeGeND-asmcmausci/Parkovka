/**
 * Single, idempotent payment completion path shared by the Click and Payme
 * callbacks.
 *
 * The payment row is locked with `SELECT ... FOR UPDATE`, so two concurrent or
 * repeated callbacks can never complete (and propagate) the same payment twice.
 */

import { prisma } from "./db";

export type CompletionOutcome =
  | "completed"
  | "already_completed"
  | "not_found"
  | "amount_mismatch"
  | "invalid_state";

export interface CompletionResult {
  result: CompletionOutcome;
  paidAt?: Date;
}

interface LockedPayment {
  id: string;
  status: string;
  amountCents: number;
  reservationId: string | null;
  parkingSessionId: string | null;
  paidAt: Date | null;
}

export const completePaymentOnce = async (input: {
  paymentId: string;
  providerTxId: string;
  provider: "click" | "payme" | "cash";
  amountCents?: number;
  failureReason?: string;
}): Promise<CompletionResult> => {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<LockedPayment[]>`
      SELECT "id", "status", "amountCents", "reservationId", "parkingSessionId", "paidAt"
      FROM "Payment"
      WHERE "id" = ${input.paymentId}
      FOR UPDATE
    `;

    if (rows.length === 0) return { result: "not_found" as const };

    const payment = rows[0];

    if (input.amountCents !== undefined && input.amountCents !== payment.amountCents) {
      return { result: "amount_mismatch" as const };
    }

    if (payment.status === "COMPLETED") {
      return { result: "already_completed" as const, paidAt: payment.paidAt ?? undefined };
    }

    if (payment.status === "REFUNDED") {
      return { result: "invalid_state" as const };
    }

    const paidAt = new Date();

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "COMPLETED",
        provider: input.provider,
        providerTxId: input.providerTxId,
        paidAt,
        failureReason: null,
        failedAt: null,
      },
    });

    if (payment.reservationId) {
      await tx.reservation.update({
        where: { id: payment.reservationId },
        data: { paymentStatus: "COMPLETED" },
      });
    }

    if (payment.parkingSessionId) {
      await tx.parkingSession.update({
        where: { id: payment.parkingSessionId },
        data: { status: "COMPLETED", finalPriceCents: payment.amountCents },
      });
    }

    return { result: "completed" as const, paidAt };
  });
};

/**
 * Mark a payment as failed without ever touching a completed payment.
 */
export const failPaymentOnce = async (input: {
  paymentId: string;
  providerTxId: string;
  provider: "click" | "payme";
  reason: string;
}): Promise<"failed" | "already_completed" | "not_found"> => {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT "id", "status" FROM "Payment" WHERE "id" = ${input.paymentId} FOR UPDATE
    `;

    if (rows.length === 0) return "not_found" as const;
    if (rows[0].status === "COMPLETED") return "already_completed" as const;

    await tx.payment.update({
      where: { id: input.paymentId },
      data: {
        status: "FAILED",
        provider: input.provider,
        providerTxId: input.providerTxId,
        failureReason: input.reason,
        failedAt: new Date(),
      },
    });

    return "failed" as const;
  });
};
