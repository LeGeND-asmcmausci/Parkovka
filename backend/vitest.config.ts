import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: "test",
      PAYMENT_TEST_MODE: "true",
      PAYMENT_TEST_SECRET: "local-test-payment-secret",
    },
  },
});
