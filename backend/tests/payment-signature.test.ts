import crypto from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  clickSignString,
  verifyClickSignature,
  verifyPaymeBasicAuth,
  verifyTestSignature,
} from "../src/utils/payment-security";

const restore: Array<() => void> = [];

const setEnv = (key: string, value: string | undefined) => {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  restore.push(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
};

afterEach(() => {
  while (restore.length > 0) restore.pop()?.();
});

describe("Click provider signature", () => {
  it("accepts a correctly signed payload", () => {
    setEnv("CLICK_SECRET_KEY", "click-test-secret");
    setEnv("CLICK_SERVICE_ID", "12345");

    const body = {
      click_trans_id: "555",
      service_id: "12345",
      merchant_trans_id: "6f0e1c1a-1111-4111-8111-111111111111",
      amount: "5000",
      action: "1",
      sign_time: "2026-11-06 10:00:00",
    };

    const signString = clickSignString({
      clickTransId: body.click_trans_id,
      serviceId: body.service_id,
      secretKey: "click-test-secret",
      merchantTransId: body.merchant_trans_id,
      amount: body.amount,
      action: body.action,
      signTime: body.sign_time,
    });

    expect(verifyClickSignature({ ...body, sign_string: signString }).ok).toBe(true);
  });

  it("rejects a missing or tampered signature", () => {
    setEnv("CLICK_SECRET_KEY", "click-test-secret");

    const body = {
      click_trans_id: "555",
      merchant_trans_id: "6f0e1c1a-1111-4111-8111-111111111111",
      amount: "5000",
      action: "1",
      sign_time: "2026-11-06 10:00:00",
    };

    expect(verifyClickSignature(body)).toEqual({ ok: false, reason: "missing_signature" });
    expect(verifyClickSignature({ ...body, sign_string: "0".repeat(32) })).toEqual({
      ok: false,
      reason: "invalid_signature",
    });
  });

  it("refuses to verify when no provider key is configured", () => {
    setEnv("CLICK_SECRET_KEY", undefined);
    setEnv("CLICK_SECRET", undefined);
    expect(verifyClickSignature({ sign_string: "abc" })).toEqual({
      ok: false,
      reason: "not_configured",
    });
  });
});

describe("Payme Basic authentication", () => {
  it("accepts the merchant key and rejects wrong credentials", () => {
    setEnv("PAYME_SECRET_KEY", "payme-test-key");
    setEnv("PAYME_KEY", undefined);

    const encode = (value: string) => `Basic ${Buffer.from(value).toString("base64")}`;

    expect(verifyPaymeBasicAuth(encode("Paycom:payme-test-key")).ok).toBe(true);
    expect(verifyPaymeBasicAuth(encode("Paycom:wrong")).ok).toBe(false);
    expect(verifyPaymeBasicAuth(undefined)).toEqual({
      ok: false,
      reason: "missing_credentials",
    });
  });
});

describe("HMAC test-mode signature", () => {
  it("verifies the raw-body signature and rejects tampering", () => {
    const secret = "local-test-payment-secret";
    setEnv("PAYMENT_TEST_SECRET", secret);

    const raw = JSON.stringify({ paymentId: "p1", amount: 5000 });
    const signature = crypto.createHmac("sha256", secret).update(raw).digest("hex");

    expect(verifyTestSignature(raw, `sha256=${signature}`)).toBe(true);
    expect(verifyTestSignature(raw, signature)).toBe(true);
    expect(verifyTestSignature(raw, `sha256=${"0".repeat(64)}`)).toBe(false);
    expect(verifyTestSignature(raw, undefined)).toBe(false);
    expect(verifyTestSignature(JSON.stringify({ paymentId: "p1", amount: 1 }), `sha256=${signature}`)).toBe(false);
  });
});
