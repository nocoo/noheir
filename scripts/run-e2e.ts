/**
 * E2E test runner — runs all E2E test suites.
 *
 * Targets:
 *   - Local: a `wrangler dev` server on http://127.0.0.1:8787 (default).
 *   - CI / remote: set WORKER_URL (and WORKER_SECRET) to point at a
 *     deployed Worker. In CI we hard-fail if the Worker is unreachable;
 *     locally we skip with exit 0 (so pre-push hooks stay friendly when
 *     the dev server isn't running).
 */

import { $ } from "bun";

const isCI = process.env.CI === "true";
const envWorkerUrl = process.env.WORKER_URL?.trim();

// In CI, WORKER_URL must be set via repo secrets. If it isn't, skip
// gracefully (don't fail the build) — matches the project rule that
// missing secrets should not break CI.
if (isCI && !envWorkerUrl) {
  console.warn("WORKER_URL not set in CI — skipping E2E tests");
  process.exit(0);
}

const WORKER_URL = envWorkerUrl ?? "http://127.0.0.1:8787";

const isWorkerRunning = await fetch(`${WORKER_URL}/api/live`)
  .then((r) => r.ok)
  .catch(() => false);

if (!isWorkerRunning) {
  if (isCI) {
    console.error(`Worker not reachable at ${WORKER_URL} — failing in CI`);
    process.exit(1);
  }
  console.error(`Worker not running at ${WORKER_URL} — skipping E2E tests`);
  process.exit(0);
}

console.log(`Running Worker E2E tests against ${WORKER_URL}...`);
const result = await $`bun test --cwd . worker/tests/e2e`.nothrow();
process.exit(result.exitCode);
