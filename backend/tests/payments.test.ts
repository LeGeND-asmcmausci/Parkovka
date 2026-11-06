import crypto from "crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/utils/db";
import { seed } from "../prisma/seed";
import { startTestServer, rawPost, TestServer } from "./helpers/server";

const run = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const TEST_SECRET = "local-test-payment-secret";

let srv: TestServer;
const createdPaymentIds: string[] = [];
const createdReservationIds: string[] = [];
let facilityId = "";
let spaceId = "";

const sign = (rawBody: string) =>
  `sha256=${crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("hex")}`;

const clickBody = (paymentId: string, amountUzs: number, action = 1) => ({
  click_trans_id: `click-${run}-${paymentId.slice(0, 6)}`,
  merchant_trans_id: paymentId,
  amount: amountUzs,
  action,
  sign_time: "2026-11-06 10:00:00",
});

const paymeBody = (paymentId: string, amountCents: number, method: string) => ({
  jsonrpc: "2.0",
  id: `rpc-${run}`,
  method,
  params: {
    id: `payme-${run}-${paymentId.slice(0, 6)}`,
    time: Date.now(),
    amount: amountCents,
    account: { payment_id: paymentId },
  },
});

const createPayment = async (amountCents = 500000) => {
  const payment = await prisma.payment.create({
    data: {
      amountCents,
      currency: "UZS",
      paymentMethod: "CLICK",
      status: "PENDING",
      description: `test payment ${run}`,
    },
  });
  createdPaymentIds.push(payment.id);
  return payment;
};

beforeAll(async () => {
  srv = await startTestServer();
  // Reference data (idempotent, uses deterministic ids).
  await seed();

  const facility = await prisma.parkingFacility.findFirstOrThrow({
    where: { name: "Parkovka Markaziy" },
    include: { ParkingSpace: { take: 1 } },
  });
  facilityId = facility.id;
  spaceId = facility.ParkingSpace[0].id;
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
  await prisma.reservation.deleteMany({ where: { id: { in: createdReservationIds } } });
  await srv.close();
  await prisma.$disconnect();
});

describe("Click callbacks", () => {
  it("rejects an unsigned callback and leaves the payment PENDING", async () => {
    const payment = await createPayment();

    const res = await rawPost(
      srv.baseUrl,
      "/api/payments/click/callback",
      JSON.stringify(clickBody(payment.id, payment.amountCents / 100))
    );

    expect(res.status).toBe(401);
    expect(res.body.error).toBe(-1);

    const stored = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(stored?.status).toBe("PENDING");
    expect(stored?.paidAt).toBeNull();
  });

  it("rejects a wrongly signed callback", async () => {
    const payment = await createPayment();

    const res = await rawPost(
      srv.baseUrl,
      "/api/payments/click/callback",
      JSON.stringify(clickBody(payment.id, payment.amountCents / 100)),
      { "x-test-signature": "sha256=deadbeef" }
    );

    expect(res.status).toBe(401);

    const stored = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(stored?.status).toBe("PENDING");
  });

  it("rejects a signed callback with the wrong amount", async () => {
    const payment = await createPayment();

    const rawBody = JSON.stringify(clickBody(payment.id, payment.amountCents / 100 + 1));
    const res = await rawPost(srv.baseUrl, "/api/payments/click/callback", rawBody, {
      "x-test-signature": sign(rawBody),
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(-2);

    const stored = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(stored?.status).toBe("PENDING");
  });

  it("completes the payment once, idempotently, and settles the reservation", async () => {
    const reservation = await prisma.reservation.create({
      data: {
        userId: (
          await prisma.user.findFirstOrThrow({ where: { email: "user@parkovka.local" } })
        ).id,
        spaceId,
        facilityId,
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        status: "CONFIRMED",
        paymentStatus: "PENDING",
        priceCents: 400000,
        currency: "UZS",
      },
    });
    createdReservationIds.push(reservation.id);

    const payment = await prisma.payment.create({
      data: {
        userId: reservation.userId,
        reservationId: reservation.id,
        amountCents: 400000,
        currency: "UZS",
        paymentMethod: "CLICK",
        status: "PENDING",
      },
    });
    createdPaymentIds.push(payment.id);

    const body = JSON.stringify(clickBody(payment.id, 4000));
    const first = await rawPost(srv.baseUrl, "/api/payments/click/callback", body, {
      "x-test-signature": sign(body),
    });

    expect(first.status).toBe(200);
    expect(first.body.error).toBe(0);

    const afterFirst = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(afterFirst.status).toBe("COMPLETED");
    expect(afterFirst.paidAt).not.toBeNull();

    const reservationAfterFirst = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(reservationAfterFirst.paymentStatus).toBe("COMPLETED");

    const second = await rawPost(srv.baseUrl, "/api/payments/click/callback", body, {
      "x-test-signature": sign(body),
    });

    expect(second.status).toBe(200);
    expect(second.body.data.idempotent).toBe(true);

    const afterSecond = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(afterSecond.status).toBe("COMPLETED");
    expect(afterSecond.paidAt?.getTime()).toBe(afterFirst.paidAt?.getTime());

    const paymentCount = await prisma.payment.count({ where: { reservationId: reservation.id } });
    expect(paymentCount).toBe(1);
  });

  it("completes only once under concurrent duplicate callbacks", async () => {
    const payment = await createPayment();
    const body = JSON.stringify(clickBody(payment.id, payment.amountCents / 100));

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        rawPost(srv.baseUrl, "/api/payments/click/callback", body, {
          "x-test-signature": sign(body),
        })
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
    }

    const idempotentCount = responses.filter((response) => response.body.data?.idempotent).length;
    expect(idempotentCount).toBe(4);

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe("COMPLETED");
  });
});

describe("Payme callbacks", () => {
  it("rejects a callback without provider authentication", async () => {
    const payment = await createPayment();

    const res = await rawPost(
      srv.baseUrl,
      "/api/payments/payme/callback",
      JSON.stringify(paymeBody(payment.id, payment.amountCents, "PerformTransaction"))
    );

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(-32504);

    const stored = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(stored?.status).toBe("PENDING");
  });

  it("rejects a signed callback for the wrong amount", async () => {
    const payment = await createPayment();
    const rawBody = JSON.stringify(
      paymeBody(payment.id, payment.amountCents + 100, "CheckPerformTransaction")
    );

    const res = await rawPost(srv.baseUrl, "/api/payments/payme/callback", rawBody, {
      "x-test-signature": sign(rawBody),
    });

    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-31001);

    const stored = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(stored?.status).toBe("PENDING");
  });

  it("performs a valid transaction and repeats it idempotently", async () => {
    const payment = await createPayment();

    const createRaw = JSON.stringify(
      paymeBody(payment.id, payment.amountCents, "CreateTransaction")
    );
    const created = await rawPost(srv.baseUrl, "/api/payments/payme/callback", createRaw, {
      "x-test-signature": sign(createRaw),
    });

    expect(created.status).toBe(200);
    expect(created.body.result.state).toBe(1);

    const performRaw = JSON.stringify(
      paymeBody(payment.id, payment.amountCents, "PerformTransaction")
    );
    const performed = await rawPost(srv.baseUrl, "/api/payments/payme/callback", performRaw, {
      "x-test-signature": sign(performRaw),
    });

    expect(performed.status).toBe(200);
    expect(performed.body.result.state).toBe(2);

    const firstPaidAt = (
      await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    ).paidAt;

    expect(firstPaidAt).not.toBeNull();

    const repeated = await rawPost(srv.baseUrl, "/api/payments/payme/callback", performRaw, {
      "x-test-signature": sign(performRaw),
    });

    expect(repeated.status).toBe(200);
    expect(repeated.body.result.perform_time).toBe(firstPaidAt?.getTime());

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe("COMPLETED");
    expect(stored.paidAt?.getTime()).toBe(firstPaidAt?.getTime());
  });

  it("cannot cancel a completed payment", async () => {
    const payment = await createPayment();

    const createRaw = JSON.stringify(
      paymeBody(payment.id, payment.amountCents, "CreateTransaction")
    );
    await rawPost(srv.baseUrl, "/api/payments/payme/callback", createRaw, {
      "x-test-signature": sign(createRaw),
    });

    const performRaw = JSON.stringify(
      paymeBody(payment.id, payment.amountCents, "PerformTransaction")
    );
    await rawPost(srv.baseUrl, "/api/payments/payme/callback", performRaw, {
      "x-test-signature": sign(performRaw),
    });

    const cancelRaw = JSON.stringify(
      paymeBody(payment.id, payment.amountCents, "CancelTransaction")
    );
    const cancel = await rawPost(srv.baseUrl, "/api/payments/payme/callback", cancelRaw, {
      "x-test-signature": sign(cancelRaw),
    });

    expect(cancel.body.error.code).toBe(-31007);

    const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(stored.status).toBe("COMPLETED");
  });
});
