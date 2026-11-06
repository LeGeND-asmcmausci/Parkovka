import "dotenv/config";

// Deterministic payment verification for tests: no real provider credentials
// exist here, so the secure HMAC test mode is used.
delete process.env.CLICK_SECRET_KEY;
delete process.env.CLICK_SECRET;
delete process.env.PAYME_SECRET_KEY;
delete process.env.PAYME_KEY;

process.env.PAYMENT_TEST_MODE = "true";
process.env.PAYMENT_TEST_SECRET = "local-test-payment-secret";
