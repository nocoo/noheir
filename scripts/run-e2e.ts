/**
 * E2E test runner — boots `wrangler dev --local --persist-to ...` against
 * a local D1 emulator (a SQLite file under `.wrangler/state-e2e/`),
 * applies every migration to it, then runs `worker/tests/e2e/**` as real
 * fetch() clients. Tears wrangler down on exit.
 *
 * Inspired by ../surety/scripts/run-l2-http.ts. The point is full
 * isolation from any remote D1 — no test data is ever sent to
 * Cloudflare.
 *
 * In CI we also boot the local emulator (no remote dependency). The old
 * `WORKER_URL`-points-at-deployed-worker mode is gone; we removed the
 * remote test database it relied on.
 */

import { spawn, type Subprocess } from "bun";
import { rmSync } from "node:fs";
import { createServer } from "node:net";

// noheir's port band per the personal port plan: dev 7004, L2 (E2E)
// dev + 10000 = 17004, BDD dev + 20000 (unused). E2E_PORT can override.
const PORT = Number(process.env.E2E_PORT ?? 17004);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = `${import.meta.dir}/..`;
const WORKER_DIR = `${ROOT}/worker`;
const PERSIST_DIR = `.wrangler/state-e2e`;
const HEALTH_TIMEOUT_MS = 30_000;
const SHUTDOWN_GRACE_MS = 5_000;
const TEST_TOKEN = "test-token";

let wrangler: Subprocess | null = null;

function log(msg: string): void {
  console.log(`[e2e] ${msg}`);
}

async function ensurePortFree(): Promise<void> {
  // Bind-and-release probe: if anything else owns the port (e.g. a
  // long-running `wrangler dev`), the runner should fail loudly with
  // an actionable message rather than silently spawning a wrangler
  // that crashes a few seconds later.
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `port ${PORT} is in use — kill the process holding it (lsof -i :${PORT}) ` +
              `or set E2E_PORT to a free port`,
          ),
        );
      } else {
        reject(err);
      }
    });
    probe.once("listening", () => {
      probe.close(() => resolve());
    });
    probe.listen(PORT, "127.0.0.1");
  });
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/live`);
      if (res.ok || res.status === 503) {
        // 503 = worker is up, DB probe failed. We treat it as ready
        // because the e2e tests will hit endpoints that may exercise
        // those branches anyway.
        return;
      }
    } catch (err) {
      lastErr = err;
    }
    await Bun.sleep(300);
  }
  throw new Error(`wrangler dev never became healthy on ${BASE}: ${String(lastErr)}`);
}

function applyMigrations(): void {
  // Wipe local state so re-runs start from an empty D1.
  try {
    rmSync(`${WORKER_DIR}/${PERSIST_DIR}`, { recursive: true, force: true });
  } catch {
    // ignore
  }
  log(`applying migrations to local D1 (${PERSIST_DIR})`);
  const proc = Bun.spawnSync(
    [
      "bunx",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "noheir-db",
      "--local",
      "--persist-to",
      PERSIST_DIR,
    ],
    { cwd: WORKER_DIR, stdout: "pipe", stderr: "pipe" },
  );
  if (proc.exitCode !== 0) {
    console.error(proc.stdout.toString());
    console.error(proc.stderr.toString());
    throw new Error("migration apply failed");
  }
}

async function startWrangler(): Promise<void> {
  log(`starting wrangler dev on :${PORT}`);
  wrangler = spawn(
    [
      "bunx",
      "wrangler",
      "dev",
      "--local",
      "--persist-to",
      PERSIST_DIR,
      "--port",
      String(PORT),
      "--inspector-port",
      "0",
      "--ip",
      "127.0.0.1",
      "--var",
      `WORKER_TOKEN:${TEST_TOKEN}`,
    ],
    {
      cwd: WORKER_DIR,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, WRANGLER_LOG: "error" },
    },
  );
  const drain = async (stream: ReadableStream<Uint8Array>, label: string): Promise<void> => {
    const reader = stream.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) process.stderr.write(`[${label}] ${dec.decode(value)}`);
    }
  };
  void drain(wrangler.stdout as ReadableStream<Uint8Array>, "wrangler");
  void drain(wrangler.stderr as ReadableStream<Uint8Array>, "wrangler!");
}

async function stopWrangler(): Promise<void> {
  if (!wrangler) return;
  log("stopping wrangler dev");
  wrangler.kill("SIGTERM");
  const t = setTimeout(() => {
    if (wrangler && wrangler.exitCode === null) {
      wrangler.kill("SIGKILL");
    }
  }, SHUTDOWN_GRACE_MS);
  await wrangler.exited;
  clearTimeout(t);
  wrangler = null;
}

async function runTests(): Promise<number> {
  // E2E suites use Bun's built-in test runner — Vitest can't be a
  // drop-in replacement because the suites lean on Bun-specific
  // matchers like `.toBeString()`. We invoke `bun test` directly,
  // pinned to `worker/tests/e2e`, so unrelated test directories
  // don't get pulled in.
  const proc = spawn(["bun", "test", "worker/tests/e2e"], {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      WORKER_URL: BASE,
      WORKER_TOKEN: TEST_TOKEN,
    },
  });
  return await proc.exited;
}

async function main(): Promise<void> {
  await ensurePortFree();
  applyMigrations();
  await startWrangler();
  try {
    await waitForHealth();
    const code = await runTests();
    process.exitCode = code;
  } finally {
    await stopWrangler();
  }
}

const cleanup = async (): Promise<void> => {
  await stopWrangler();
  process.exit(process.exitCode ?? 1);
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

await main();
