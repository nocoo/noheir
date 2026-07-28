import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { type AllRepos, createAllRepos } from "../db/repositories";
import {
  commitUnitSchema,
  createContributionLogSchema,
  createExpenseCategorySchema,
  createProductSchema,
  createRecurringExpenseSchema,
  createUnitSchema,
  searchContributionLogsSchema,
  updateContributionLogSchema,
  updateExpenseCategorySchema,
  updateProductSchema,
  updateRecurringExpenseSchema,
  updateUnitSchema,
} from "../db/validation";
import { buildCommitStatements, type SwapTarget } from "../lib/unit-commit";
import { APP_VERSION, COMPONENT_NAME } from "../lib/version";

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
function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
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
  WORKER_TOKEN: string;
  SITE_URL?: string;
}

// ── Hono Context Variables ──

type Variables = {
  userId: string;
  repos: AllRepos;
  db: DrizzleD1Database;
  d1: D1Database; // Raw D1 binding for batch operations
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── CORS ──

app.use(
  "*",
  cors({
    // Only allow requests from the frontend domain
    origin: (origin) => {
      if (!origin) return null; // Allow server-to-server requests (no Origin header)
      const allowedOrigins = [
        "https://noheir.hexly.ai",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ];
      return allowedOrigins.includes(origin) ? origin : null;
    },
    allowHeaders: ["Content-Type", "Authorization", "X-User-Id", "X-Internal-Action"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

// ── Surety-standard live check (no auth) ──

const bootedAt = Date.now();

function sanitizeError(msg: string): string {
  return msg.replace(/\bok\b/gi, "***");
}

app.get("/api/live", async (c) => {
  const db = drizzle(c.env.DB);
  const uptime = Math.round((Date.now() - bootedAt) / 1000);
  const base = {
    version: APP_VERSION,
    component: COMPONENT_NAME,
    timestamp: new Date().toISOString(),
    uptime,
  };

  try {
    await db.run(sql`SELECT 1 AS probe`);
    return c.json({ status: "ok", ...base, database: { connected: true } }, 200);
  } catch (err) {
    const message = err instanceof Error ? sanitizeError(err.message) : "unknown";
    return c.json(
      { status: "error", ...base, database: { connected: false, error: message } },
      503,
    );
  }
});

// Legacy alias — kept for backward compatibility
app.get("/api/health", async (c) => c.redirect("/api/live", 301));

// ── SQL API Endpoints (for Next.js MCP server) ──
// All authed routes verify a single shared secret: WORKER_TOKEN.

/**
 * /api/v1/query - Execute read-only SQL queries
 * Body: { sql: string, params?: unknown[] }
 * Returns: { results: T[], meta: { changes: number, duration: number } }
 */
app.post("/api/v1/query", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }
  const token = authHeader.slice(7);
  const secret = c.env.WORKER_TOKEN;
  if (!secret || !timingSafeEqual(token, secret)) {
    return c.json({ error: "Invalid token" }, 403);
  }

  try {
    const body = await c.req.json<{ sql: string; params?: unknown[] }>();
    if (!body.sql || typeof body.sql !== "string") {
      return c.json({ error: "sql is required" }, 400);
    }

    const d1 = c.env.DB;
    const start = Date.now();
    const stmt = d1.prepare(body.sql).bind(...(body.params ?? []));
    const result = await stmt.all();
    const duration = Date.now() - start;

    return c.json({
      results: result.results,
      meta: { changes: result.meta.changes ?? 0, duration },
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Query failed" }, 500);
  }
});

/**
 * /api/v1/execute - Execute write SQL queries (INSERT/UPDATE/DELETE)
 * Body: { sql: string, params?: unknown[] } or { statements: { sql: string, params?: unknown[] }[] }
 * Returns: { meta: { changes: number, duration: number } } or { results: ...[] }
 */
app.post("/api/v1/execute", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }
  const token = authHeader.slice(7);
  const secret = c.env.WORKER_TOKEN;
  if (!secret || !timingSafeEqual(token, secret)) {
    return c.json({ error: "Invalid token" }, 403);
  }

  try {
    const body = await c.req.json<{
      sql?: string;
      params?: unknown[];
      statements?: { sql: string; params?: unknown[] }[];
    }>();

    const d1 = c.env.DB;
    const start = Date.now();

    // Batch mode
    if (body.statements && Array.isArray(body.statements)) {
      const stmts = body.statements.map((s) => d1.prepare(s.sql).bind(...(s.params ?? [])));
      const batchResults = await d1.batch(stmts);
      const duration = Date.now() - start;

      return c.json({
        results: batchResults.map((r) => ({
          results: r.results,
          meta: { changes: r.meta.changes ?? 0, duration },
        })),
      });
    }

    // Single statement mode
    if (!body.sql || typeof body.sql !== "string") {
      return c.json({ error: "sql is required" }, 400);
    }

    const stmt = d1.prepare(body.sql).bind(...(body.params ?? []));
    const result = await stmt.run();
    const duration = Date.now() - start;

    return c.json({
      results: [],
      meta: { changes: result.meta.changes ?? 0, duration },
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Execute failed" }, 500);
  }
});

// ── Auth middleware (all routes below require Bearer token + X-User-Id) ──

app.use("*", async (c, next) => {
  // Skip for already-handled routes (live check, SQL API)
  if (c.req.path === "/api/live" || c.req.path === "/api/health") return next();
  if (c.req.path.startsWith("/api/v1/")) return next(); // SQL API

  // 1. Verify Bearer token
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  const secret = c.env.WORKER_TOKEN;

  if (!secret || !timingSafeEqual(token, secret)) {
    return c.json({ error: "Invalid token" }, 403);
  }

  // 2. Extract X-User-Id
  const userId = c.req.header("X-User-Id");
  if (!userId) {
    return c.json({ error: "Missing X-User-Id header" }, 400);
  }

  // 3. Resolve DB
  const d1Binding = c.env.DB;
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

async function handleUserSync(
  c: {
    get: (key: "userId") => string;
    req: { json: <T>() => Promise<T> };
    json: (data: unknown, status?: number) => Response;
  } & { get(key: "repos"): AllRepos },
) {
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
  const count = await repos.transactions.createMany(
    userId,
    body.rows as Parameters<AllRepos["transactions"]["createMany"]>[1],
  );
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
  const count = await repos.transfers.createMany(
    userId,
    body.rows as Parameters<AllRepos["transfers"]["createMany"]>[1],
  );
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

app.get("/api/products/summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { includeArchived } = c.req.query();

  const { buildProductsSummary } = await import("../lib/products-summary");

  // Fetch active products
  const activeProducts = await repos.products.findAll(userId, { includeArchived: false });

  // Count archived products
  const archivedCount = await repos.products.countArchived(userId);

  // Build summary
  let summary = buildProductsSummary(activeProducts, archivedCount);

  // If includeArchived, also add archived products to the breakdown
  if (includeArchived === "true") {
    const archivedProducts = await repos.products.findAll(userId, { includeArchived: true });
    // Recompute with all products
    summary = buildProductsSummary(archivedProducts, archivedCount);
  }

  return c.json(summary);
});

app.get("/api/products", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { channel, category, currency, includeArchived, fields, limit, offset } = c.req.query();

  // Parse pagination params: limit is optional, no limit if not specified
  const limitNum =
    limit !== undefined ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : undefined;
  const offsetNum = Math.max(parseInt(offset ?? "0", 10) || 0, 0);

  const allProducts = await repos.products.findAll(userId, {
    ...pickDefined({ channel, category, currency }),
    includeArchived: includeArchived === "true",
  });

  // Paginate
  const paginatedProducts =
    limitNum !== undefined
      ? allProducts.slice(offsetNum, offsetNum + limitNum)
      : allProducts.slice(offsetNum);

  // Determine field level: minimal or full (default: full for backward compatibility)
  const fieldLevel = fields === "minimal" ? "minimal" : "full";

  if (fieldLevel === "minimal") {
    // Return minimal fields only
    const minimalProducts = paginatedProducts.map((p) => ({
      id: p.id,
      name: p.name,
      channel: p.channel,
      category: p.category,
      currency: p.currency,
    }));
    return c.json({
      products: minimalProducts,
      total_returned: minimalProducts.length,
      total_count: allProducts.length,
    });
  }

  // Full: return everything
  return c.json({
    products: paginatedProducts,
    total_returned: paginatedProducts.length,
    total_count: allProducts.length,
  });
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
    // Error can be wrapped in DrizzleQueryError with cause chain
    const errMsg =
      err instanceof Error
        ? err.message + (err.cause instanceof Error ? err.cause.message : "")
        : "";
    if (errMsg.includes("FOREIGN KEY")) {
      return c.json(
        {
          error: "Cannot delete product with contribution history. Archive it instead.",
          hasContributionLogs: true,
        },
        409,
      );
    }
    throw err; // Re-throw other errors for global handler
  }
});

// ── Units ──

app.get("/api/units/summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");

  // Import summary builder dynamically to avoid circular deps
  const { buildUnitsSummary } = await import("../lib/units-summary");

  // Fetch all units with products (needed for lock period)
  const units = await repos.units.findAllWithProducts(userId);

  // Fetch latest invest logs for availability calculation
  const unitIds = units.map((u) => u.id);
  const latestInvestLogs = await repos.contributionLogs.getLatestInvestLogs(userId, unitIds);

  // Enrich with availability and build summary
  const unitsWithAvailability = repos.units.enrichWithAvailability(units, latestInvestLogs);
  const summary = buildUnitsSummary(unitsWithAvailability);

  return c.json(summary);
});

app.get("/api/units", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const {
    status,
    strategy,
    tactics,
    currency,
    with_products,
    fields,
    limit,
    offset,
    available_within_days,
  } = c.req.query();
  const filters = pickDefined({ status, strategy, tactics, currency });

  // Parse pagination params: limit is optional, no limit if not specified
  const limitNum =
    limit !== undefined ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : undefined;
  const offsetNum = Math.max(parseInt(offset ?? "0", 10) || 0, 0);

  // Parse available_within_days filter
  const availableWithinDays =
    available_within_days !== undefined ? parseInt(available_within_days, 10) : undefined;

  // Determine field level: minimal (default), standard, full
  const fieldLevel = fields === "standard" || fields === "full" ? fields : "minimal";

  // For backward compatibility, with_products=true implies full
  const effectiveFieldLevel = with_products === "true" ? "full" : fieldLevel;

  // available_within_days requires standard or full (forces upgrade if minimal)
  const needsAvailability = availableWithinDays !== undefined && !Number.isNaN(availableWithinDays);
  const computeLevel =
    needsAvailability && effectiveFieldLevel === "minimal" ? "standard" : effectiveFieldLevel;

  if (computeLevel === "minimal") {
    // Minimal: direct query, no joins, no availability
    const allUnits = await repos.units.findAll(userId, filters);
    const paginatedUnits =
      limitNum !== undefined
        ? allUnits.slice(offsetNum, offsetNum + limitNum)
        : allUnits.slice(offsetNum);
    // Return minimal fields only
    const minimalUnits = paginatedUnits.map((u) => ({
      id: u.id,
      unitCode: u.unitCode,
      amountCents: u.amountCents,
      status: u.status,
      strategy: u.strategy,
      tactics: u.tactics,
      currency: u.currency,
      productId: u.productId,
    }));
    return c.json({
      units: minimalUnits,
      total_returned: minimalUnits.length,
      total_count: allUnits.length,
    });
  }

  // Standard or Full: need product join + availability calculation
  const allUnits = await repos.units.findAllWithProducts(userId, filters);
  const unitIds = allUnits.map((u) => u.id);
  const latestInvestLogs = await repos.contributionLogs.getLatestInvestLogs(userId, unitIds);
  let enrichedUnits = repos.units.enrichWithAvailability(allUnits, latestInvestLogs);

  // Apply available_within_days filter if specified
  if (needsAvailability) {
    enrichedUnits = enrichedUnits.filter((u) => {
      // unknown availability = no data, exclude from filter
      if (u.daysUntilAvailable === null) return false;
      return u.daysUntilAvailable <= availableWithinDays;
    });
  }

  // Paginate after filtering
  const paginatedUnits =
    limitNum !== undefined
      ? enrichedUnits.slice(offsetNum, offsetNum + limitNum)
      : enrichedUnits.slice(offsetNum);

  if (
    effectiveFieldLevel === "standard" ||
    (effectiveFieldLevel === "minimal" && needsAvailability)
  ) {
    // Standard: include availability but not full product details
    const standardUnits = paginatedUnits.map((u) => ({
      id: u.id,
      unitCode: u.unitCode,
      amountCents: u.amountCents,
      status: u.status,
      strategy: u.strategy,
      tactics: u.tactics,
      currency: u.currency,
      productId: u.productId,
      availableDate: u.availableDate,
      isAvailable: u.isAvailable,
      daysUntilAvailable: u.daysUntilAvailable,
      daysUntilLocked: u.daysUntilLocked,
      latestInvestDate: u.latestInvestDate,
    }));
    return c.json({
      units: standardUnits,
      total_returned: standardUnits.length,
      total_count: enrichedUnits.length,
    });
  }

  // Full: return everything
  return c.json({
    units: paginatedUnits,
    total_returned: paginatedUnits.length,
    total_count: enrichedUnits.length,
  });
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

  const productIdChanging =
    parsed.data.productId !== undefined && original.productId !== parsed.data.productId;

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
      return c.json(
        {
          error: "Conflict: unit was modified by another request. Please retry.",
        },
        409,
      );
    }

    // Phase 2: Insert logs (UPDATE succeeded, we "own" this transition)
    const today = getLocalDateString();
    const logStatements: D1PreparedStatement[] = [];

    if (original.productId) {
      const oldProduct = await repos.products.findById(userId, original.productId);
      logStatements.push(
        d1
          .prepare(
            `INSERT INTO contribution_logs
           (id, user_id, unit_id, product_id, product_name, operation_type, amount_cents, operation_date, source, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            userId,
            id,
            original.productId,
            oldProduct?.name ?? null,
            "withdraw",
            -original.amountCents,
            today,
            "auto",
            `Auto: moved out to ${newProductId ? "another product" : "unassigned"}`,
            now,
            now,
          ),
      );
    }

    if (newProductId) {
      const newProduct = await repos.products.findById(userId, newProductId);
      logStatements.push(
        d1
          .prepare(
            `INSERT INTO contribution_logs
           (id, user_id, unit_id, product_id, product_name, operation_type, amount_cents, operation_date, source, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            userId,
            id,
            newProductId,
            newProduct?.name ?? null,
            "invest",
            original.amountCents,
            today,
            "auto",
            `Auto: moved in from ${original.productId ? "another product" : "unassigned"}`,
            now,
            now,
          ),
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
          await d1
            .prepare(rollbackSql)
            .bind(original.productId, Date.now(), id, userId, newProductId)
            .run();
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

// ── Unit Commit (docs/003) ──

/**
 * Timeline for one unit, plus the raw snapshot the client echoes back as
 * `expected` on commit.
 *
 * They travel together so the client is never tempted to build `expected` from
 * a mapped/defaulted shape — that was the actual failure mode (docs/003 §
 * Decision B), since `toDomainUnit` turns NULLs into "" and would fail the
 * guard forever.
 *
 * This is not a consistent snapshot: the unit and the logs are two reads, so a
 * concurrent commit between them can pair an older `expected` with newer logs.
 * That is harmless — a stale `expected` simply loses the CAS and returns 409,
 * which is exactly what should happen.
 */
app.get("/api/units/:id/logs", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const id = c.req.param("id");

  const unit = await repos.units.findById(userId, id);
  if (!unit) {
    return c.json({ error: "Not found" }, 404);
  }

  const logs = await repos.contributionLogs.listByUnit(userId, id);

  return c.json({
    logs,
    expected: {
      unitCode: unit.unitCode,
      amountCents: unit.amountCents,
      productId: unit.productId,
      currency: unit.currency,
      status: unit.status,
      strategy: unit.strategy,
      tactics: unit.tactics,
      startDate: unit.startDate,
      endDate: unit.endDate,
      note: unit.note,
    },
  });
});

app.post("/api/units/:id/commit", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const d1 = c.get("d1");
  const id = c.req.param("id");
  const body = await c.req.json();

  const parsed = commitUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  const original = await repos.units.findById(userId, id);
  if (!original) {
    return c.json({ error: "Not found" }, 404);
  }

  const { metadata, operations, commitNote, expected } = parsed.data;
  const operationDate = parsed.data.operationDate ?? getLocalDateString();

  // ── Referential checks (Zod cannot query the DB) ──
  const swapOp = operations.find((o) => o.kind === "swap_unit_code");
  let swapTarget: SwapTarget | undefined;
  if (swapOp) {
    if (swapOp.targetUnitId === id) {
      return c.json({ error: "Cannot swap a unit code with itself" }, 400);
    }
    const target = await repos.units.findById(userId, swapOp.targetUnitId);
    if (!target) {
      return c.json({ error: "Swap target unit not found" }, 404);
    }
    const targetProduct = target.productId
      ? await repos.products.findById(userId, target.productId)
      : null;
    swapTarget = {
      id: target.id,
      unitCode: target.unitCode,
      productId: target.productId,
      productName: targetProduct?.name ?? null,
    };
  }

  const switchOp = operations.find((o) => o.kind === "switch_product");
  let toProduct: { id: string; name: string | null } | null = null;
  if (switchOp) {
    if (switchOp.toProductId === original.productId) {
      return c.json({ error: "Unit is already in that product" }, 400);
    }
    if (switchOp.pnlCents != null && !original.productId) {
      return c.json({ error: "pnl requires an existing product to withdraw from" }, 400);
    }
    if (switchOp.toProductId) {
      const product = await repos.products.findById(userId, switchOp.toProductId);
      if (!product) {
        return c.json({ error: "Target product not found" }, 404);
      }
      toProduct = { id: product.id, name: product.name };
    }
  }

  const fromProduct = original.productId
    ? await repos.products.findById(userId, original.productId)
    : null;

  const statements = buildCommitStatements({
    userId,
    unitId: id,
    expected,
    metadata,
    operations,
    operationDate,
    today: getLocalDateString(),
    commitNote,
    swapTarget,
    fromProduct: fromProduct ? { id: fromProduct.id, name: fromProduct.name } : null,
    toProduct,
    now: Date.now(),
    newId: () => crypto.randomUUID(),
  });

  // One batch = one transaction. A stale `expected` makes statement [0] match
  // zero rows, which collapses every guarded statement after it — so a conflict
  // is a committed no-op we detect here rather than a partial write.
  const results = await d1.batch(statements.map((s) => d1.prepare(s.sql).bind(...s.params)));

  if (!results[0]?.meta.changes) {
    return c.json({ error: "Conflict: unit was modified by another request. Please retry." }, 409);
  }

  const row = await repos.units.findById(userId, id);
  return c.json({ unit: row });
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

  const row = await repos.contributionLogs.update(
    userId,
    c.req.param("id"),
    stripUndefined(parsed.data),
  );
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

  const result = await repos.reports.yearlySummary(userId, parseInt(year, 10));
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

  const result = await repos.reports.accountSummary(userId, parseInt(year, 10));
  return c.json(result);
});

app.get("/api/reports/flow-summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year } = c.req.query();

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.flowSummary(userId, parseInt(year, 10));
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

// ── Expense Categories (002 spec) ──

app.get("/api/expense-categories", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const categories = await repos.expenseCategories.findAll(userId);
  return c.json({ categories });
});

app.post("/api/expense-categories", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const parsed = createExpenseCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }
  const result = await repos.expenseCategories.create(userId, parsed.data);
  if (!result.ok) {
    return c.json({ error: "Category name already exists" }, 409);
  }
  return c.json({ category: result.category }, 201);
});

app.put("/api/expense-categories/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const parsed = updateExpenseCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }
  const result = await repos.expenseCategories.update(
    userId,
    c.req.param("id"),
    stripUndefined(parsed.data),
  );
  if (result.ok) {
    return c.json({ category: result.category });
  }
  if (result.reason === "not_found") {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ error: "Category name already exists" }, 409);
});

app.delete("/api/expense-categories/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const deleted = await repos.expenseCategories.delete(userId, c.req.param("id"));
  return deleted ? c.body(null, 204) : c.json({ error: "Not found" }, 404);
});

// ── Recurring Expenses (002 spec) ──
//
// `status` and `endedAt` are state-machine fields. To prevent the web
// client from accidentally flipping them through the generic PUT, the
// endpoint silently drops both unless the caller asserts intent via
// `X-Internal-Action: 1`. The Server Action layer is the only caller
// that sets that header (pause / resume / end actions). This is a
// contract guard, not a security boundary — `WORKER_TOKEN` is the
// security boundary.

const INTERNAL_ACTION_HEADER = "X-Internal-Action";

function isInternalActionRequest(c: {
  req: { header: (k: string) => string | undefined };
}): boolean {
  return c.req.header(INTERNAL_ACTION_HEADER) === "1";
}

app.get("/api/recurring-expenses", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const rules = await repos.recurringExpenses.findAll(userId);
  return c.json({ rules });
});

app.post("/api/recurring-expenses", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const parsed = createRecurringExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }
  const result = await repos.recurringExpenses.create(userId, parsed.data);
  if (!result.ok) {
    return c.json({ error: "Category not found" }, 400);
  }
  return c.json({ rule: result.rule }, 201);
});

app.put("/api/recurring-expenses/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const parsed = updateRecurringExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }
  // Drop status + endedAt unless the caller proves intent via the
  // X-Internal-Action header. Note: the keys must be deleted, not just
  // set to undefined, so they don't reach the DB layer at all.
  const data = stripUndefined(parsed.data) as Record<string, unknown>;
  if (!isInternalActionRequest(c)) {
    delete data.status;
    delete data.endedAt;
  }
  const result = await repos.recurringExpenses.update(userId, c.req.param("id"), data);
  if (result.ok) {
    return c.json({ rule: result.rule });
  }
  if (result.reason === "not_found") {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ error: "Category not found" }, 400);
});

app.delete("/api/recurring-expenses/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const deleted = await repos.recurringExpenses.delete(userId, c.req.param("id"));
  return deleted ? c.body(null, 204) : c.json({ error: "Not found" }, 404);
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
