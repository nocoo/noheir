/**
 * E2E test client factory.
 *
 * Defaults to a local `wrangler dev` server with `targetDb: "test"` so all
 * queries go to the local test D1 binding. In CI (or any environment that
 * targets an already-deployed Worker), set `WORKER_URL` and `WORKER_SECRET`
 * to override.
 */

const WORKER_BASE_URL =
  process.env.WORKER_URL ?? "http://127.0.0.1:8787";
const WORKER_SECRET =
  process.env.WORKER_SECRET ??
  "b5edfb5b65dd841904149c2b6e59e7d5977ad8ade330c2768893f81e32bb7605";

// ── Lightweight HTTP helper (no WorkerDbClient dependency) ──

export interface FetchOptions {
  method?: string;
  path: string;
  userId?: string;
  targetDb?: "test" | "production";
  body?: unknown;
  token?: string;
  omitAuth?: boolean;
  /**
   * Override the default fetch redirect behavior. Useful for asserting
   * 3xx responses directly (e.g. /api/health → /api/live).
   */
  redirect?: RequestRedirect;
}

/**
 * Raw fetch against the local Worker — used for auth failure tests
 * and cases where WorkerDbClient would throw before we can inspect the status.
 */
export async function rawFetch(opts: FetchOptions): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!opts.omitAuth) {
    headers["Authorization"] = `Bearer ${opts.token ?? WORKER_SECRET}`;
  }
  if (opts.userId) {
    headers["X-User-Id"] = opts.userId;
  }
  headers["X-Target-DB"] = opts.targetDb ?? "test";

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }
  if (opts.redirect !== undefined) {
    init.redirect = opts.redirect;
  }

  return fetch(`${WORKER_BASE_URL}${opts.path}`, init);
}

// ── Typed API helpers for common operations ──

export async function api<T>(opts: FetchOptions): Promise<T> {
  const res = await rawFetch(opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown");
    throw new Error(`${res.status} ${opts.method ?? "GET"} ${opts.path}: ${text}`);
  }
  return (await res.json()) as T;
}

// ── Constants ──

export const BASE_URL = WORKER_BASE_URL;
export const SECRET = WORKER_SECRET;

export const TEST_USER_A = "e2e-user-alpha";
export const TEST_USER_B = "e2e-user-beta";
export const TEST_USER_C = "e2e-user-gamma";
