/**
 * E2E test runner — runs all E2E test suites.
 *
 * Currently: Worker API E2E tests (requires `wrangler dev` running on :8787).
 * Future: Playwright browser E2E tests.
 */

import { $ } from "bun";

const isWorkerRunning = await fetch("http://127.0.0.1:8787/api/live")
  .then((r) => r.ok)
  .catch(() => false);

if (!isWorkerRunning) {
  console.error("Worker not running on :8787 — skipping E2E tests");
  process.exit(0);
}

console.log("Running Worker E2E tests...");
const result = await $`bun test --cwd . worker/tests/e2e`.nothrow();
process.exit(result.exitCode);
