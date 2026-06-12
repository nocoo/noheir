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

const PORT = 8787;
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
  throw new Error(
    `wrangler dev never became healthy on ${BASE}: ${String(lastErr)}`,
  );
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
  const drain = async (
    stream: ReadableStream<Uint8Array>,
    label: string,
  ): Promise<void> => {
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
  const proc = spawn(["bun", "run", "test:worker:e2e"], {
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
