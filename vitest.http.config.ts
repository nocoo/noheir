import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["worker/tests/e2e/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
