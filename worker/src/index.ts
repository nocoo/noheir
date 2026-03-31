import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createAllRepos, type AllRepos } from "../db/repositories";

/** Strip undefined values from an object at runtime.
 *  Returns a clean Record<string, string> that satisfies exactOptionalPropertyTypes. */
function pickDefined(obj: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

// ── Cloudflare Bindings ──

export interface Env {
  DB: D1Database;
  DB_TEST: D1Database;
  WORKER_SHARED_SECRET: string;
}

// ── Hono Context Variables ──

type Variables = {
  userId: string;
  repos: AllRepos;
  db: DrizzleD1Database;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── CORS ──

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-User-Id",
      "X-Target-DB",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

// ── Health check (no auth) ──

app.get("/api/live", async (c) => {
  const db = drizzle(c.env.DB);
  try {
    await db.run(sql`SELECT 1 AS ok`);
    return c.json({ status: "ok", timestamp: Date.now() });
  } catch {
    return c.json({ status: "error", timestamp: Date.now() }, 500);
  }
});

// ── Auth middleware (all routes below require Bearer token + X-User-Id) ──

app.use("*", async (c, next) => {
  // Skip for already-handled routes
  if (c.req.path === "/api/live") return next();

  // 1. Verify Bearer token
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  const secret = c.env.WORKER_SHARED_SECRET;

  if (!secret || !timingSafeEqual(token, secret)) {
    return c.json({ error: "Invalid token" }, 403);
  }

  // 2. Extract X-User-Id
  const userId = c.req.header("X-User-Id");
  if (!userId) {
    return c.json({ error: "Missing X-User-Id header" }, 400);
  }

  // 3. Resolve target DB
  const targetDb = c.req.header("X-Target-DB") ?? "production";
  const d1Binding = targetDb === "test" ? c.env.DB_TEST : c.env.DB;
  const db = drizzle(d1Binding);
  const repos = createAllRepos(db);

  // 4. Set context
  c.set("userId", userId);
  c.set("repos", repos);
  c.set("db", db);

  return next();
});

// ── Users ──

app.post("/api/users/upsert", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json<{
    email: string;
    name?: string;
    image?: string;
    providerAccountId: string;
  }>();
  const user = await repos.users.upsert({
    id: userId,
    email: body.email,
    name: body.name,
    image: body.image,
    providerAccountId: body.providerAccountId,
  });
  return c.json({ user }, 201);
});

// ── Transactions ──
// NOTE: Static paths MUST come before :id to avoid Hono matching "count-by-year" as an id.

app.post("/api/transactions/search", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const result = await repos.transactions.search(userId, body);
  return c.json(result);
});

app.post("/api/transactions/bulk", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json<{ rows: unknown[] }>();
  const count = await repos.transactions.createMany(userId, body.rows as Parameters<AllRepos["transactions"]["createMany"]>[1]);
  return c.json({ inserted: count }, 201);
});

app.get("/api/transactions/count-by-year", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const yearStr = c.req.query("year");
  if (!yearStr) return c.json({ error: "year is required" }, 400);
  const count = await repos.transactions.countByYear(userId, parseInt(yearStr, 10));
  return c.json({ count });
});

app.delete("/api/transactions/by-year", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const yearStr = c.req.query("year");
  if (!yearStr) return c.json({ error: "year is required" }, 400);
  const deleted = await repos.transactions.deleteByYear(userId, parseInt(yearStr, 10));
  return c.json({ deleted });
});

app.post("/api/transactions", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const row = await repos.transactions.create(userId, body);
  return c.json({ transaction: row }, 201);
});

app.get("/api/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.transactions.findById(userId, c.req.param("id"));
  return row ? c.json({ transaction: row }) : c.json({ transaction: null }, 404);
});

app.put("/api/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const row = await repos.transactions.update(userId, c.req.param("id"), body);
  return row ? c.json({ transaction: row }) : c.json({ error: "Not found" }, 404);
});

app.delete("/api/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const ok = await repos.transactions.delete(userId, c.req.param("id"));
  return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
});

// ── Transfers ──
// NOTE: Static paths MUST come before :id to avoid Hono matching "count-by-year" as an id.

app.post("/api/transfers/search", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const result = await repos.transfers.search(userId, body);
  return c.json(result);
});

app.post("/api/transfers/bulk", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json<{ rows: unknown[] }>();
  const count = await repos.transfers.createMany(userId, body.rows as Parameters<AllRepos["transfers"]["createMany"]>[1]);
  return c.json({ inserted: count }, 201);
});

app.get("/api/transfers/count-by-year", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const yearStr = c.req.query("year");
  if (!yearStr) return c.json({ error: "year is required" }, 400);
  const count = await repos.transfers.countByYear(userId, parseInt(yearStr, 10));
  return c.json({ count });
});

app.delete("/api/transfers/by-year", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const yearStr = c.req.query("year");
  if (!yearStr) return c.json({ error: "year is required" }, 400);
  const deleted = await repos.transfers.deleteByYear(userId, parseInt(yearStr, 10));
  return c.json({ deleted });
});

app.post("/api/transfers", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const row = await repos.transfers.create(userId, body);
  return c.json({ transfer: row }, 201);
});

app.get("/api/transfers/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.transfers.findById(userId, c.req.param("id"));
  return row ? c.json({ transfer: row }) : c.json({ transfer: null }, 404);
});

app.put("/api/transfers/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const row = await repos.transfers.update(userId, c.req.param("id"), body);
  return row ? c.json({ transfer: row }) : c.json({ error: "Not found" }, 404);
});

app.delete("/api/transfers/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const ok = await repos.transfers.delete(userId, c.req.param("id"));
  return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
});

// ── Products ──

app.get("/api/products", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { channel, category, currency } = c.req.query();
  const products = await repos.products.findAll(userId, pickDefined({ channel, category, currency }));
  return c.json({ products, total_returned: products.length });
});

app.get("/api/products/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.products.findById(userId, c.req.param("id"));
  return row ? c.json({ product: row }) : c.json({ product: null }, 404);
});

app.post("/api/products", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const row = await repos.products.create(userId, body);
  return c.json({ product: row }, 201);
});

app.put("/api/products/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const row = await repos.products.update(userId, c.req.param("id"), body);
  return row ? c.json({ product: row }) : c.json({ error: "Not found" }, 404);
});

app.delete("/api/products/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const ok = await repos.products.delete(userId, c.req.param("id"));
  return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
});

// ── Units ──

app.get("/api/units", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { status, strategy, tactics, currency, with_products } = c.req.query();

  if (with_products === "true") {
    const units = await repos.units.findAllWithProducts(userId);
    return c.json({ units, total_returned: units.length });
  }

  const units = await repos.units.findAll(userId, pickDefined({ status, strategy, tactics, currency }));
  return c.json({ units, total_returned: units.length });
});

app.get("/api/units/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.units.findById(userId, c.req.param("id"));
  return row ? c.json({ unit: row }) : c.json({ unit: null }, 404);
});

app.post("/api/units", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const row = await repos.units.create(userId, body);
  return c.json({ unit: row }, 201);
});

app.put("/api/units/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const row = await repos.units.update(userId, c.req.param("id"), body);
  return row ? c.json({ unit: row }) : c.json({ error: "Not found" }, 404);
});

app.delete("/api/units/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const ok = await repos.units.delete(userId, c.req.param("id"));
  return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
});

// ── Settings ──

app.get("/api/settings", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.settings.getByUserId(userId);
  return c.json({ settings: row });
});

app.put("/api/settings", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const row = await repos.settings.upsert(userId, body);
  return c.json({ settings: row });
});

app.delete("/api/settings", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const ok = await repos.settings.deleteByUser(userId);
  return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
});

// ── Metadata ──

app.get("/api/metadata", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const result = await repos.metadata.getAll(userId);
  return c.json(result);
});

// ── Reports ──

app.get("/api/reports/yearly-summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year } = c.req.query();

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.yearlySummary(
    userId,
    parseInt(year, 10),
  );
  return c.json(result);
});

app.get("/api/reports/category-summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year, type } = c.req.query();

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.categorySummary(
    userId,
    parseInt(year, 10),
    type || undefined,
  );
  return c.json(result);
});

app.get("/api/reports/account-summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year } = c.req.query();

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.accountSummary(
    userId,
    parseInt(year, 10),
  );
  return c.json(result);
});

app.get("/api/reports/flow-summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year } = c.req.query();

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.flowSummary(
    userId,
    parseInt(year, 10),
  );
  return c.json(result);
});

app.get("/api/reports/monthly", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year, month, currency } = c.req.query();

  if (!year || !month) {
    return c.json({ error: "year and month are required" }, 400);
  }

  const result = await repos.reports.monthly(
    userId,
    parseInt(year, 10),
    parseInt(month, 10),
    currency || undefined,
  );
  return c.json(result);
});

// ── Backup / Restore (Phase 1.9) ──

app.get("/api/backup", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");

  const [txResult, trResult, products, units, setting] = await Promise.all([
    repos.transactions.search(userId, { limit: 5000 }),
    repos.transfers.search(userId, { limit: 5000 }),
    repos.products.findAll(userId),
    repos.units.findAll(userId),
    repos.settings.getByUserId(userId),
  ]);

  return c.json({
    transactions: txResult.transactions,
    transfers: trResult.transfers,
    products,
    units,
    settings: setting,
    exported_at: new Date().toISOString(),
  });
});

app.post("/api/restore", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json<{
    transactions?: unknown[];
    transfers?: unknown[];
    products?: unknown[];
    units?: unknown[];
    settings?: unknown;
  }>();

  // Delete existing data first (user-scoped only)
  await Promise.all([
    repos.transactions.deleteByUser(userId),
    repos.transfers.deleteByUser(userId),
  ]);

  // TODO: Phase 1.9 — full restore with products, units, settings
  const results = {
    transactions_imported: 0,
    transfers_imported: 0,
  };

  if (body.transactions && Array.isArray(body.transactions)) {
    results.transactions_imported = await repos.transactions.createMany(
      userId,
      body.transactions as Parameters<AllRepos["transactions"]["createMany"]>[1],
    );
  }

  if (body.transfers && Array.isArray(body.transfers)) {
    results.transfers_imported = await repos.transfers.createMany(
      userId,
      body.transfers as Parameters<AllRepos["transfers"]["createMany"]>[1],
    );
  }

  return c.json(results, 201);
});

// ── 404 fallback ──

app.notFound((c) => c.json({ error: "Not found" }, 404));

// ── Error handler ──

app.onError((err, c) => {
  console.error(`[Worker Error] ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: "Internal server error" }, 500);
});

// ── Timing-safe comparison ──

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < aBuf.length; i++) {
    result |= (aBuf[i] ?? 0) ^ (bBuf[i] ?? 0);
  }
  return result === 0;
}

// ── Export ──

export default app;
