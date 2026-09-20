import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/bdd",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "html",
  use: { baseURL: "http://127.0.0.1:27004", trace: "retain-on-failure", headless: true },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/test-server.ts",
    url: "http://127.0.0.1:27004/api/live",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
