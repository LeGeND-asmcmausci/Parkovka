/**
 * Provider authentication for Click and Payme callbacks.
 *
 * Policy (fail closed):
 *  - Provider secret configured  -> the provider's own signature/auth is required.
 *  - No provider secret, PAYMENT_TEST_MODE=true and PAYMENT_TEST_SECRET set
 *      -> an HMAC-SHA256 signature over the raw request body is required
 *         ("x-test-signature: sha256=<hex>"). Unsigned calls are rejected.
 *  - No provider secret and test mode off -> 503, callbacks are refused.
 *  - PAYMENT_TEST_MODE in production is refused (503) so a test signature can
 *    never complete a real payment.
 *
 * Nothing here can be bypassed with a flag that skips verification.
 */

import crypto from "crypto";

const env = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
};

export const isProduction = (): boolean => process.env.NODE_ENV === "production";

export const clickCredentials = (): { secretKey: string; serviceId?: string } | null => {
  const secretKey = env("CLICK_SECRET_KEY") ?? env("CLICK_SECRET");
  if (!secretKey) return null;
  return { secretKey, serviceId: env("CLICK_SERVICE_ID") };
};

export const paymeCredentials = (): { secretKey: string } | null => {
  const secretKey = env("PAYME_SECRET_KEY") ?? env("PAYME_KEY");
  if (!secretKey) return null;
  return { secretKey };
};

export const testModeEnabled = (): boolean => env("PAYMENT_TEST_MODE") === "true";

export const testSecret = (): string | undefined => env("PAYMENT_TEST_SECRET");

export const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

/**
 * Click Prepare/Complete signature:
 * md5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)
 */
export const clickSignString = (params: {
  clickTransId: string;
  serviceId: string;
  secretKey: string;
  merchantTransId: string;
  amount: string;
  action: string;
  signTime: string;
}): string =>
  crypto
    .createHash("md5")
    .update(
      `${params.clickTransId}${params.serviceId}${params.secretKey}` +
        `${params.merchantTransId}${params.amount}${params.action}${params.signTime}`
    )
    .digest("hex");

const asString = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

export type VerificationFailure =
  | "not_configured"
  | "missing_signature"
  | "invalid_signature"
  | "missing_credentials"
  | "invalid_credentials";

export interface VerificationResult {
  ok: boolean;
  reason?: VerificationFailure;
}

export const verifyClickSignature = (
  body: Record<string, unknown>
): VerificationResult => {
  const credentials = clickCredentials();
  if (!credentials) return { ok: false, reason: "not_configured" };

  const signature = asString(body.sign_string).toLowerCase();
  if (!signature) return { ok: false, reason: "missing_signature" };

  const expected = clickSignString({
    clickTransId: asString(body.click_trans_id),
    serviceId: asString(body.service_id ?? credentials.serviceId),
    secretKey: credentials.secretKey,
    merchantTransId: asString(body.merchant_trans_id),
    amount: asString(body.amount),
    action: asString(body.action),
    signTime: asString(body.sign_time),
  });

  return safeEqual(expected, signature)
    ? { ok: true }
    : { ok: false, reason: "invalid_signature" };
};

/**
 * Payme uses HTTP Basic auth: `Paycom:<merchant_key>` (base64).
 */
export const verifyPaymeBasicAuth = (
  header: string | undefined
): VerificationResult => {
  const credentials = paymeCredentials();
  if (!credentials) return { ok: false, reason: "not_configured" };
  if (!header || !header.startsWith("Basic ")) {
    return { ok: false, reason: "missing_credentials" };
  }

  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return { ok: false, reason: "missing_credentials" };

  const key = decoded.slice(separator + 1);
  if (!key) return { ok: false, reason: "missing_credentials" };

  return safeEqual(key, credentials.secretKey)
    ? { ok: true }
    : { ok: false, reason: "invalid_credentials" };
};

export const signTestPayload = (rawBody: string, secret: string): string =>
  crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

export const verifyTestSignature = (
  rawBody: string | undefined,
  header: string | undefined
): boolean => {
  const secret = testSecret();
  if (!secret || !rawBody || !header) return false;

  const provided = header.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!provided) return false;

  return safeEqual(signTestPayload(rawBody, secret), provided);
};

export interface CallbackAuth {
  ok: boolean;
  mode?: "provider" | "test";
  status?: number;
  message?: string;
}

export interface CallbackAuthInput {
  rawBody?: string;
  testSignature?: string;
  clickBody?: Record<string, unknown>;
  paymeAuthHeader?: string;
}

export const authenticateCallback = (
  provider: "click" | "payme",
  input: CallbackAuthInput
): CallbackAuth => {
  if (isProduction() && testModeEnabled()) {
    return {
      ok: false,
      status: 503,
      message: "Test payment mode is disabled in production",
    };
  }

  const credentials = provider === "click" ? clickCredentials() : paymeCredentials();

  if (credentials) {
    const verification =
      provider === "click"
        ? verifyClickSignature(input.clickBody ?? {})
        : verifyPaymeBasicAuth(input.paymeAuthHeader);

    if (verification.ok) return { ok: true, mode: "provider" };

    return {
      ok: false,
      status: 401,
      message:
        verification.reason === "missing_signature" ||
        verification.reason === "missing_credentials"
          ? "Missing provider authentication"
          : "Invalid provider authentication",
    };
  }

  if (!testModeEnabled()) {
    return {
      ok: false,
      status: 503,
      message: `${provider} provider is not configured`,
    };
  }

  if (!testSecret()) {
    return {
      ok: false,
      status: 503,
      message: "Payment test mode requires PAYMENT_TEST_SECRET",
    };
  }

  if (!verifyTestSignature(input.rawBody, input.testSignature)) {
    return { ok: false, status: 401, message: "Invalid payment signature" };
  }

  return { ok: true, mode: "test" };
};
