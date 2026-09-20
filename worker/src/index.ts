import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { createD1Db, type Db } from "../../src/lib/db";
import { type AllRepos, createAllRepos } from "../db/repositories";
import {
  commitUnitSchema,
  createContributionLogSchema,
  createExpenseCategorySchema,
  createProductSchema,
  createRecurringExpenseSchema,
  createTransactionSchema,
  createTransferSchema,
  createUnitSchema,
  recurringStateBodySchema,
  searchContributionLogsSchema,
  updateContributionLogSchema,
  updateExpenseCategorySchema,
  updateProductSchema,
  updateRecurringExpenseSchema,
  updateSettingsSchema,
  updateTransactionSchema,
  updateTransferSchema,
  updateUnitSchema,
  yearImportBodySchema,
} from "../db/validation";
import type { ExistingUser } from "../lib/identity";
import { parseTransactionImportRow, parseTransferImportRow } from "../lib/import-parse";
import { liveHeaders, livePayload, liveStatus, resolveBuildSha } from "../lib/live";
import { ALLOWED_FROM, isRecurringStatus, patchForTransition } from "../lib/recurring-state";
import { isApiPath, isPublicRoute, originOf } from "../lib/request-policy";
import { buildCommitStatements, type SwapTarget } from "../lib/unit-commit";
import type { NormalizedTransactionRow, NormalizedTransferRow } from "../lib/year-import";
import {
  buildUserReplaceStatements,
  buildYearReplaceStatements,
  chunkJsonArrays,
  MAX_IMPORT_BODY_BYTES,
  payloadExceedsBodyMax,
  transactionJsonRow,
  transferJsonRow,
  validateImportEnvelope,
  validateRowList,
} from "../lib/year-import";
import { authenticateRequest } from "./access";
import type { Env } from "./env";
import {
  handleMcpAuthorize,
  handleMcpCallback,
  handleMcpProtocol,
  handleMcpRegister,
  handleMcpRevoke,
  handleMcpToken,
  handleWellKnown,
} from "./mcp";

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

// Env bindings: worker/src/env.ts (root wrangler.jsonc).

// ── Hono Context Variables ──

type Variables = {
  userId: string;
  user: ExistingUser;
  repos: AllRepos;
  db: DrizzleD1Database;
  d1: D1Database;
  sqlDb: Db;
};

export type AppEnv = { Bindings: Env; Variables: Variables };

const app = new Hono<AppEnv>();

app.use(
  "*",
  bodyLimit({
    maxSize: MAX_IMPORT_BODY_BYTES,
    onError: (c) => c.json({ error: "Request body too large" }, 413),
  }),
);

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return origin;
      const site = originOf(c.env.SITE_URL);
      return site && origin === site ? origin : "";
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.use("*", async (c, next) => {
  const d1 = c.env.DB;
  const db = drizzle(d1);
  c.set("d1", d1);
  c.set("db", db);
  c.set("repos", createAllRepos(db));
  c.set("sqlDb", createD1Db(d1));
  return next();
});

app.get("/api/live", async (c) => {
  const headers = liveHeaders();
  const buildSha = resolveBuildSha(c.env.BUILD_SHA);
  try {
    await drizzle(c.env.DB).run(sql`SELECT 1 AS probe`);
    return c.json(livePayload({ connected: true, buildSha }), liveStatus(true), headers);
  } catch {
    return c.json(livePayload({ connected: false, buildSha }), liveStatus(false), headers);
  }
});

app.get("/.well-known/oauth-authorization-server", () => handleWellKnown());
app.post("/api/mcp/register", (c) => handleMcpRegister(c));
app.post("/api/mcp/token", (c) => handleMcpToken(c));
app.post("/api/mcp/revoke", (c) => handleMcpRevoke(c));
app.post("/api/mcp", (c) => handleMcpProtocol(c));
app.get("/api/mcp", (c) =>
  c.json({ error: "SSE transport not supported. Use Streamable HTTP (POST)." }, 405),
);
app.delete("/api/mcp", (c) =>
  c.json({ error: "Session termination not supported in stateless mode." }, 405),
);

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  const path = new URL(c.req.url).pathname;
  if (isPublicRoute(c.req.method, path)) return next();

  const result = await authenticateRequest(c.req.raw, c.env, async (email) => {
    const rows = await c.get("repos").users.findByNormalizedEmail(email);
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name ?? null,
      image: row.image ?? null,
      providerAccountId: row.providerAccountId,
    }));
  });

  if (!result.ok) {
    const status =
      result.reason === "misconfigured" ? 503 : result.reason === "unauthenticated" ? 401 : 403;
    return c.json({ error: "Unauthorized" }, status);
  }

  c.set("userId", result.user.id);
  c.set("user", result.user);
  return next();
});

app.get("/api/auth/me", (c) => {
  const user = c.get("user");
  return c.json({
    user: { id: user.id, email: user.email, name: user.name, image: user.image },
  });
});

app.get("/api/mcp/authorize", (c) => handleMcpAuthorize(c));
app.get("/api/mcp/callback", (c) => handleMcpCallback(c));

// ── Transactions ──

app.post("/api/transactions/import", async (c) => {
  const body = yearImportBodySchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid import request" }, 400);
  const parsed = validateImportEnvelope<NormalizedTransactionRow>(
    body.data.year,
    body.data.rows,
    parseTransactionImportRow,
    (row) => row.year,
  );
  if (!parsed.ok) return c.json({ error: parsed.message }, 400);
  const chunks = chunkJsonArrays(parsed.rows.map(transactionJsonRow));
  if (!chunks.ok || payloadExceedsBodyMax(chunks.chunks))
    return c.json({ error: "Import too large" }, 413);
  const statements = buildYearReplaceStatements({
    table: "transactions",
    userId: c.get("userId"),
    year: body.data.year,
    chunks: chunks.chunks,
    createdAt: Math.floor(Date.now() / 1000),
  });
  await c.get("sqlDb").batch(statements);
  return c.json({ imported: parsed.rows.length });
});

app.post("/api/transactions/search", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const result = await repos.transactions.search(userId, body);
  return c.json(result);
});

app.post("/api/transactions/bulk", async (c) => {
  const body = await c.req.json<{ rows?: unknown }>();
  const parsed = validateRowList(body?.rows, parseTransactionImportRow);
  if (!parsed.ok) return c.json({ error: parsed.message }, 400);
  const chunks = chunkJsonArrays(parsed.rows.map(transactionJsonRow));
  if (!chunks.ok || payloadExceedsBodyMax(chunks.chunks))
    return c.json({ error: "Import too large" }, 413);
  const statements = buildUserReplaceStatements({
    table: "transactions",
    userId: c.get("userId"),
    chunks: chunks.chunks,
    createdAt: Math.floor(Date.now() / 1000),
  }).slice(1);
  if (statements.length) await c.get("sqlDb").batch(statements);
  return c.json({ inserted: parsed.rows.length }, 201);
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
  const parsed = createTransactionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid transactions record" }, 400);
  const body = parsed.data;
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
  const parsed = updateTransactionSchema.safeParse(await c.req.json());
  if (!parsed.success || !Object.keys(parsed.data).length)
    return c.json({ error: "Invalid transactions update" }, 400);
  const body = parsed.data;
  const row = await repos.transactions.update(userId, c.req.param("id"), stripUndefined(body));
  return row ? c.json({ transaction: row }) : c.json({ error: "Not found" }, 404);
});

app.delete("/api/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const ok = await repos.transactions.delete(userId, c.req.param("id"));
  return ok ? c.json({ success: true }) : c.json({ error: "Not found" }, 404);
});

// ── Transfers ──

app.post("/api/transfers/import", async (c) => {
  const body = yearImportBodySchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid import request" }, 400);
  const parsed = validateImportEnvelope<NormalizedTransferRow>(
    body.data.year,
    body.data.rows,
    parseTransferImportRow,
    (row) => row.year,
  );
  if (!parsed.ok) return c.json({ error: parsed.message }, 400);
  const chunks = chunkJsonArrays(parsed.rows.map(transferJsonRow));
  if (!chunks.ok || payloadExceedsBodyMax(chunks.chunks))
    return c.json({ error: "Import too large" }, 413);
  const statements = buildYearReplaceStatements({
    table: "transfers",
    userId: c.get("userId"),
    year: body.data.year,
    chunks: chunks.chunks,
    createdAt: Math.floor(Date.now() / 1000),
  });
  await c.get("sqlDb").batch(statements);
  return c.json({ imported: parsed.rows.length });
});

app.post("/api/transfers/search", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const body = await c.req.json();
  const result = await repos.transfers.search(userId, body);
  return c.json(result);
});

app.post("/api/transfers/bulk", async (c) => {
  const body = await c.req.json<{ rows?: unknown }>();
  const parsed = validateRowList(body?.rows, parseTransferImportRow);
  if (!parsed.ok) return c.json({ error: parsed.message }, 400);
  const chunks = chunkJsonArrays(parsed.rows.map(transferJsonRow));
  if (!chunks.ok || payloadExceedsBodyMax(chunks.chunks))
    return c.json({ error: "Import too large" }, 413);
  const statements = buildUserReplaceStatements({
    table: "transfers",
    userId: c.get("userId"),
    chunks: chunks.chunks,
    createdAt: Math.floor(Date.now() / 1000),
  }).slice(1);
  if (statements.length) await c.get("sqlDb").batch(statements);
  return c.json({ inserted: parsed.rows.length }, 201);
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
  const parsed = createTransferSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid transfers record" }, 400);
  const body = parsed.data;
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
  const parsed = updateTransferSchema.safeParse(await c.req.json());
  if (!parsed.success || !Object.keys(parsed.data).length)
    return c.json({ error: "Invalid transfers update" }, 400);
  const body = parsed.data;
  const row = await repos.transfers.update(userId, c.req.param("id"), stripUndefined(body));
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
  if (parsed.data.productId && !(await repos.products.findById(userId, parsed.data.productId))) {
    return c.json({ error: "Product not found" }, 404);
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

  // Availability is derived from the latest invest log (or an override), never
  // from start_date. Without an invest log or override, a unit created with a
  // product already attached renders as "状态未知" forever.
  if (row.status === "已成立" && row.productId) {
    const product = await repos.products.findById(userId, row.productId);
    await repos.contributionLogs.create(userId, {
      unitId: row.id,
      productId: row.productId,
      productName: product?.name ?? null,
      operationType: "invest",
      amountCents: row.amountCents,
      operationDate: row.startDate ?? getLocalDateString(),
      source: "auto",
      note: "Auto: initial investment on unit creation",
    });
  }

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
  if (parsed.data.productId && !(await repos.products.findById(userId, parsed.data.productId))) {
    return c.json({ error: "Product not found" }, 404);
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
  // Resolved here so the name matches the product id in `expected`. The client
  // list omits archived products, and pairing a fresh id with a name looked up
  // from a stale prop could label the unit with a different product entirely.
  const currentProduct = unit.productId
    ? await repos.products.findById(userId, unit.productId)
    : null;
  const latestInvestLogs = await repos.contributionLogs.getLatestInvestLogs(userId, [id]);
  const [enriched] = repos.units.enrichWithAvailability(
    [{ ...unit, product: currentProduct }],
    latestInvestLogs,
  );

  return c.json({
    logs,
    currentProductName: currentProduct?.name ?? null,
    availableDate: enriched?.availableDate ?? null,
    latestInvestDate: enriched?.latestInvestDate ?? null,
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
      availableDateOverride: unit.availableDateOverride ?? null,
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

  const { metadata, commitNote, expected } = parsed.data;
  const operations = parsed.data.operations.filter((o) => {
    if (o.kind !== "set_available_date") return true;
    return o.availableDate !== (expected.availableDateOverride ?? null);
  });
  if (metadata === undefined && operations.length === 0 && !(commitNote ?? "").trim()) {
    return c.json({ error: "available date is unchanged" }, 400);
  }
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
    commitToken: crypto.randomUUID(),
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
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }
  const row = await repos.settings.upsert(userId, stripUndefined(parsed.data));
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

// ── Recurring Expenses ──

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
  const existing = await repos.recurringExpenses.findById(userId, c.req.param("id"));
  if (!existing) return c.json({ error: "Not found" }, 404);
  const merged = createRecurringExpenseSchema.safeParse({
    ...existing,
    ...stripUndefined(parsed.data),
  });
  if (!merged.success) {
    return c.json({ error: merged.error.issues.map((i) => i.message).join("; ") }, 400);
  }
  const result = await repos.recurringExpenses.update(
    userId,
    c.req.param("id"),
    stripUndefined(merged.data),
  );
  if (result.ok) {
    return c.json({ rule: result.rule });
  }
  if (result.reason === "not_found") {
    return c.json({ error: "Not found" }, 404);
  }
  return c.json({ error: "Category not found" }, 400);
});

app.post("/api/recurring-expenses/:id/state", async (c) => {
  const body = recurringStateBodySchema.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid transition" }, 400);
  const id = c.req.param("id");
  const userId = c.get("userId");
  const d1 = c.get("d1");
  const existing = await d1
    .prepare("SELECT status FROM recurring_expenses WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<{ status: string }>();
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (!isRecurringStatus(existing.status)) return c.json({ error: "Invalid rule status" }, 409);
  const patch = patchForTransition(body.data.transition, existing.status);
  if (!patch.ok) return c.json({ error: "Invalid state transition" }, 409);
  const allowed = ALLOWED_FROM[body.data.transition];
  const updated = await d1
    .prepare(
      `UPDATE recurring_expenses SET status = ?, ended_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status IN (${allowed.map(() => "?").join(",")})`,
    )
    .bind(patch.status, patch.endedAt, Math.floor(Date.now() / 1000), id, userId, ...allowed)
    .run();
  if (!updated.meta.changes) return c.json({ error: "State changed; reload and retry" }, 409);
  return c.json({ success: true });
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
  const body = await c.req.json<{ transactions?: unknown; transfers?: unknown }>();
  const transactions = validateRowList(body?.transactions, parseTransactionImportRow);
  const transfers = validateRowList(body?.transfers, parseTransferImportRow);
  if (!transactions.ok || !transfers.ok) return c.json({ error: "Invalid backup records" }, 400);
  const txChunks = chunkJsonArrays(transactions.rows.map(transactionJsonRow));
  const trChunks = chunkJsonArrays(transfers.rows.map(transferJsonRow));
  if (
    !txChunks.ok ||
    !trChunks.ok ||
    payloadExceedsBodyMax([...txChunks.chunks, ...trChunks.chunks])
  )
    return c.json({ error: "Backup too large" }, 413);
  const userId = c.get("userId");
  const createdAt = Math.floor(Date.now() / 1000);
  await c.get("sqlDb").batch([
    ...buildUserReplaceStatements({
      table: "transactions",
      userId,
      chunks: txChunks.chunks,
      createdAt,
    }),
    ...buildUserReplaceStatements({
      table: "transfers",
      userId,
      chunks: trChunks.chunks,
      createdAt,
    }),
  ]);
  return c.json(
    { transactions_imported: transactions.rows.length, transfers_imported: transfers.rows.length },
    201,
  );
});

app.get("*", async (c) => {
  if (isApiPath(c.req.path)) return c.json({ error: "Not found" }, 404);
  if (!c.env.ASSETS) return c.json({ error: "Assets unavailable" }, 503);
  return c.env.ASSETS.fetch(c.req.raw);
});

// ── 404 fallback ──

app.notFound((c) => c.json({ error: "Not found" }, 404));

// ── Error handler ──

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON" }, 400);
  console.error(`[Worker Error] ${c.req.method} ${c.req.path}:`, err.name);
  return c.json({ error: "Internal server error" }, 500);
});

// ── Export ──

export default app;
