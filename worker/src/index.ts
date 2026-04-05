import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createAllRepos, type AllRepos } from "../db/repositories";
import {
  createProductSchema,
  updateProductSchema,
  createUnitSchema,
  updateUnitSchema,
  createContributionLogSchema,
  updateContributionLogSchema,
  searchContributionLogsSchema,
} from "../db/validation";

/** Strip undefined values from an object at runtime.
 *  Returns a clean Record<string, string> that satisfies exactOptionalPropertyTypes. */
function pickDefined(obj: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

/** Strip undefined values from any object for exactOptionalPropertyTypes compatibility. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result as { [K in keyof T]: Exclude<T[K], undefined> };
}

/**
 * Get local date string in YYYY-MM-DD format.
 * Uses Asia/Shanghai timezone (UTC+8) to match user's expected "today".
 */
function getLocalDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
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
  d1: D1Database;  // Raw D1 binding for batch operations
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

async function handleHealthCheck(c: {
  env: Env;
  json: (data: unknown, status?: number) => Response;
}) {
  const db = drizzle(c.env.DB);
  try {
    await db.run(sql`SELECT 1 AS ok`);
    return c.json({ status: "ok", timestamp: Date.now() });
  } catch {
    return c.json({ status: "error", timestamp: Date.now() }, 500);
  }
}

app.get("/api/health", (c) => handleHealthCheck(c));

// ── Auth middleware (all routes below require Bearer token + X-User-Id) ──

app.use("*", async (c, next) => {
  // Skip for already-handled routes (health check)
  if (c.req.path === "/api/health") return next();

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
  c.set("d1", d1Binding);

  return next();
});

// ── Users ──

async function handleUserSync(c: {
  get: (key: "userId") => string;
  req: { json: <T>() => Promise<T> };
  json: (data: unknown, status?: number) => Response;
} & { get(key: "repos"): AllRepos }) {
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
}

app.put("/api/users/me", (c) => handleUserSync(c));

// ── Transactions ──

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

app.get("/api/transactions/years/:year/count", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const year = parseInt(c.req.param("year"), 10);
  const count = await repos.transactions.countByYear(userId, year);
  return c.json({ count });
});

app.get("/api/transactions/years/:year", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const year = parseInt(c.req.param("year"), 10);
  const rows = await repos.transactions.findAllByYear(userId, year);
  return c.json({ transactions: rows, total_returned: rows.length });
});

app.delete("/api/transactions/years/:year", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const year = parseInt(c.req.param("year"), 10);
  const deleted = await repos.transactions.deleteByYear(userId, year);
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
  return row ? c.json({ transaction: row }) : c.json({ error: "Not found" }, 404);
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

app.get("/api/transfers/years/:year/count", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const year = parseInt(c.req.param("year"), 10);
  const count = await repos.transfers.countByYear(userId, year);
  return c.json({ count });
});

app.get("/api/transfers/years/:year", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const year = parseInt(c.req.param("year"), 10);
  const rows = await repos.transfers.findAllByYear(userId, year);
  return c.json({ transfers: rows, total_returned: rows.length });
});

app.delete("/api/transfers/years/:year", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const year = parseInt(c.req.param("year"), 10);
  const deleted = await repos.transfers.deleteByYear(userId, year);
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
  return row ? c.json({ transfer: row }) : c.json({ error: "Not found" }, 404);
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
  const { channel, category, currency, includeArchived } = c.req.query();
  const products = await repos.products.findAll(userId, {
    ...pickDefined({ channel, category, currency }),
    includeArchived: includeArchived === "true",
  });
  return c.json({ products, total_returned: products.length });
});

app.get("/api/products/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.products.findById(userId, c.req.param("id"));
  return row ? c.json({ product: row }) : c.json({ error: "Not found" }, 404);
});

app.post("/api/products", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  const row = await repos.products.create(userId, parsed.data);
  return c.json({ product: row }, 201);
});

app.put("/api/products/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();

  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  const row = await repos.products.update(userId, c.req.param("id"), stripUndefined(parsed.data));
  return row ? c.json({ product: row }) : c.json({ error: "Not found" }, 404);
});

app.delete("/api/products/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const id = c.req.param("id");

  try {
    const ok = await repos.products.delete(userId, id);
    return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
  } catch (err) {
    // SQLite RESTRICT foreign key constraint violation
    // D1: "FOREIGN KEY constraint failed"
    // better-sqlite3/bun:sqlite: "FOREIGN KEY constraint failed"
    if (err instanceof Error && err.message.includes("FOREIGN KEY")) {
      return c.json({
        error: "Cannot delete product with contribution history. Archive it instead.",
        hasContributionLogs: true,
      }, 409);
    }
    throw err; // Re-throw other errors for global handler
  }
});

// ── Units ──

app.get("/api/units", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { status, strategy, tactics, currency, with_products } = c.req.query();
  const filters = pickDefined({ status, strategy, tactics, currency });

  if (with_products === "true") {
    const units = await repos.units.findAllWithProducts(userId, filters);

    // Enrich with availability info
    const unitIds = units.map((u) => u.id);
    const latestInvestLogs = await repos.contributionLogs.getLatestInvestLogs(userId, unitIds);
    const enrichedUnits = repos.units.enrichWithAvailability(units, latestInvestLogs);

    return c.json({ units: enrichedUnits, total_returned: enrichedUnits.length });
  }

  const units = await repos.units.findAll(userId, filters);
  return c.json({ units, total_returned: units.length });
});

app.get("/api/units/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const id = c.req.param("id");
  const { with_products } = c.req.query();

  if (with_products === "true") {
    const unit = await repos.units.findByIdWithProduct(userId, id);
    if (!unit) return c.json({ error: "Not found" }, 404);

    // Enrich with availability info
    const latestInvestLogs = await repos.contributionLogs.getLatestInvestLogs(userId, [id]);
    const [enrichedUnit] = repos.units.enrichWithAvailability([unit], latestInvestLogs);
    return c.json({ unit: enrichedUnit });
  }

  const row = await repos.units.findById(userId, id);
  return row ? c.json({ unit: row }) : c.json({ error: "Not found" }, 404);
});

app.post("/api/units", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();

  const parsed = createUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  // Enforce endDate invariant:
  // - status = 已归档: auto-set endDate if not provided
  // - status != 已归档: clear any endDate
  const createData = { ...parsed.data };
  if (createData.status === "已归档") {
    if (!createData.endDate) {
      createData.endDate = getLocalDateString();
    }
  } else {
    // Non-archived units must not have endDate
    createData.endDate = null;
  }

  const row = await repos.units.create(userId, createData);
  return c.json({ unit: row }, 201);
});

app.put("/api/units/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const d1 = c.get("d1");
  const id = c.req.param("id");
  const body = await c.req.json();

  // Validation (includes productId-only constraint)
  const parsed = updateUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  // Get original unit before update
  const original = await repos.units.findById(userId, id);
  if (!original) {
    return c.json({ error: "Not found" }, 404);
  }

  const productIdChanging = parsed.data.productId !== undefined
    && original.productId !== parsed.data.productId;

  if (productIdChanging) {
    const newProductId = parsed.data.productId;

    // Phase 1: CAS UPDATE - include original product_id in WHERE
    const updateSql = original.productId
      ? `UPDATE capital_units SET product_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND product_id = ?`
      : `UPDATE capital_units SET product_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND product_id IS NULL`;

    const now = Date.now();
    const updateStmt = original.productId
      ? d1.prepare(updateSql).bind(newProductId, now, id, userId, original.productId)
      : d1.prepare(updateSql).bind(newProductId, now, id, userId);

    const updateResult = await updateStmt.run();

    // CAS check
    if (!updateResult.meta.changes || updateResult.meta.changes === 0) {
      return c.json({
        error: "Conflict: unit was modified by another request. Please retry.",
      }, 409);
    }

    // Phase 2: Insert logs (UPDATE succeeded, we "own" this transition)
    const today = new Date().toISOString().slice(0, 10);
    const logStatements: D1PreparedStatement[] = [];

    if (original.productId) {
      const oldProduct = await repos.products.findById(userId, original.productId);
      logStatements.push(
        d1.prepare(
          `INSERT INTO contribution_logs
           (id, user_id, unit_id, product_id, product_name, operation_type, amount_cents, operation_date, source, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), userId, id, original.productId, oldProduct?.name ?? null,
          "withdraw", -original.amountCents, today, "auto",
          `Auto: moved out to ${newProductId ? "another product" : "unassigned"}`,
          now, now
        )
      );
    }

    if (newProductId) {
      const newProduct = await repos.products.findById(userId, newProductId);
      logStatements.push(
        d1.prepare(
          `INSERT INTO contribution_logs
           (id, user_id, unit_id, product_id, product_name, operation_type, amount_cents, operation_date, source, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), userId, id, newProductId, newProduct?.name ?? null,
          "invest", original.amountCents, today, "auto",
          `Auto: moved in from ${original.productId ? "another product" : "unassigned"}`,
          now, now
        )
      );
    }

    try {
      if (logStatements.length > 0) {
        await d1.batch(logStatements);
      }
    } catch (logError) {
      // Phase 3: Compensate - rollback the UPDATE
      const rollbackSql = newProductId
        ? `UPDATE capital_units SET product_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND product_id = ?`
        : `UPDATE capital_units SET product_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND product_id IS NULL`;

      try {
        if (newProductId) {
          await d1.prepare(rollbackSql).bind(original.productId, Date.now(), id, userId, newProductId).run();
        } else {
          await d1.prepare(rollbackSql).bind(original.productId, Date.now(), id, userId).run();
        }
      } catch {
        // Rollback failed - log for manual intervention but don't mask original error
        console.error(`Failed to rollback unit ${id} productId change after log insert failure`);
      }

      throw logError; // Re-throw to trigger 500
    }

    // Return updated unit
    const row = await repos.units.findById(userId, id);
    return c.json({ unit: row });
  }

  // Non-productId updates: use normal path
  // Enforce endDate invariant based on final status
  const updateData = { ...stripUndefined(parsed.data) };

  // Determine final status: use new status if provided, otherwise keep original
  const finalStatus = parsed.data.status ?? original.status;

  if (finalStatus === "已归档") {
    // Archived units: auto-set endDate if not explicitly provided
    // Only set if: (1) explicitly updating to 已归档, or (2) updating other fields on already-archived unit
    if (parsed.data.status !== undefined && original.status !== "已归档") {
      // Transitioning to 已归档: set endDate if not provided
      if (updateData.endDate === undefined) {
        updateData.endDate = getLocalDateString();
      }
    }
    // If already archived and endDate is being explicitly updated, allow it
    // (user override on archived unit is permitted)
  } else {
    // Non-archived units: always clear endDate regardless of what was sent
    updateData.endDate = null;
  }

  const row = await repos.units.update(userId, id, updateData);
  if (!row) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json({ unit: row });
});

app.delete("/api/units/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const ok = await repos.units.delete(userId, c.req.param("id"));
  return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
});

// ── Contribution Logs ──

app.post("/api/contribution-logs/search", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();

  const parsed = searchContributionLogsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  const result = await repos.contributionLogs.search(userId, parsed.data);
  return c.json(result);
});

app.get("/api/contribution-logs/summary/unit/:unitId", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const unitId = c.req.param("unitId");

  // Verify unit exists
  const unit = await repos.units.findById(userId, unitId);
  if (!unit) {
    return c.json({ error: "Unit not found" }, 404);
  }

  const summary = await repos.contributionLogs.summarizeByUnit(userId, unitId);
  return c.json({ summary });
});

app.get("/api/contribution-logs/summary/product/:productId", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const productId = c.req.param("productId");

  // Verify product exists
  const product = await repos.products.findById(userId, productId);
  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  const summary = await repos.contributionLogs.summarizeByProduct(userId, productId);
  return c.json({ summary });
});

app.get("/api/contribution-logs/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.contributionLogs.findById(userId, c.req.param("id"));
  return row ? c.json({ log: row }) : c.json({ error: "Not found" }, 404);
});

app.post("/api/contribution-logs", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();

  const parsed = createContributionLogSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  // Verify unit exists
  const unit = await repos.units.findById(userId, parsed.data.unitId);
  if (!unit) {
    return c.json({ error: "Unit not found" }, 404);
  }

  // Verify product exists if provided
  let productName: string | null = null;
  if (parsed.data.productId) {
    const product = await repos.products.findById(userId, parsed.data.productId);
    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }
    productName = product.name;
  }

  const row = await repos.contributionLogs.create(userId, {
    ...parsed.data,
    productName: parsed.data.productName ?? productName,
  });
  return c.json({ log: row }, 201);
});

app.put("/api/contribution-logs/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();

  const parsed = updateContributionLogSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  const row = await repos.contributionLogs.update(userId, c.req.param("id"), stripUndefined(parsed.data));
  return row ? c.json({ log: row }) : c.json({ error: "Not found" }, 404);
});

app.delete("/api/contribution-logs/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const ok = await repos.contributionLogs.softDelete(userId, c.req.param("id"));
  return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
});

app.post("/api/contribution-logs/:id/restore", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.contributionLogs.restore(userId, c.req.param("id"));
  return row ? c.json({ log: row }) : c.json({ error: "Not found or not deleted" }, 404);
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

app.get("/api/reports/metadata", async (c) => {
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
  const { year, month, type } = c.req.query();

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.categorySummary(
    userId,
    parseInt(year, 10),
    month ? parseInt(month, 10) : undefined,
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

app.get("/api/reports/monthly-summary", async (c) => {
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

// ── Data Export / Import ──

app.get("/api/data/export", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");

  const [txRows, trRows, products, units, setting] = await Promise.all([
    repos.transactions.findAllByUser(userId),
    repos.transfers.findAllByUser(userId),
    repos.products.findAll(userId),
    repos.units.findAll(userId),
    repos.settings.getByUserId(userId),
  ]);

  return c.json({
    transactions: txRows,
    transfers: trRows,
    products,
    units,
    settings: setting,
    exported_at: new Date().toISOString(),
  });
});

app.post("/api/data/import", async (c) => {
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
