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
  searchContributionLogsSchema,
  updateSettingsSchema,
  yearImportBodySchema,
} from "../db/validation";
import type { ExistingUser } from "../lib/identity";
import { parseTransactionImportRow, parseTransferImportRow } from "../lib/import-parse";
import { liveHeaders, livePayload, liveStatus, resolveBuildSha } from "../lib/live";
import { isApiPath, isPublicRoute, originOf } from "../lib/request-policy";
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
import { ApiError } from "./financial-service";
import {
  beginApiRequest,
  browserCommit,
  browserRemove,
  browserRestore,
  browserSave,
  browserState,
  createHumanApi,
  createMachineApi,
  problem,
} from "./scoped-api";

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
app.use("*", async (c, next) => {
  beginApiRequest(c);
  await next();
});

app.use(
  "*",
  bodyLimit({
    maxSize: MAX_IMPORT_BODY_BYTES,
    onError: (c) => {
      if (c.req.path === "/api/v1" || c.req.path.startsWith("/api/v1/")) {
        beginApiRequest(c);
        return problem(c, new ApiError(413, "request_body_too_large"));
      }
      return c.json({ error: "Request body too large" }, 413);
    },
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

app.get("/.well-known/api-catalog", (c) =>
  c.json({
    api: "/api/v1",
    openapi: "/api/v1/openapi.json",
    instructions: "/api/v1/instructions",
  }),
);
app.route("/api/v1", createMachineApi());

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  const path = new URL(c.req.url).pathname;
  if (isPublicRoute(c.req.method, path)) return next();

  if (c.req.header("Authorization")) return c.json({ error: "Human authentication required" }, 401);

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

app.route("/api", createHumanApi());

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

app.post("/api/transactions", (c) => browserSave(c, "transactions"));

app.get("/api/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.transactions.findById(userId, c.req.param("id"));
  return row ? c.json({ transaction: row }) : c.json({ error: "Not found" }, 404);
});

app.put("/api/transactions/:id", (c) => browserSave(c, "transactions", true));

app.delete("/api/transactions/:id", (c) => browserRemove(c, "transactions"));

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

app.post("/api/transfers", (c) => browserSave(c, "transfers"));

app.get("/api/transfers/:id", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const row = await repos.transfers.findById(userId, c.req.param("id"));
  return row ? c.json({ transfer: row }) : c.json({ error: "Not found" }, 404);
});

app.put("/api/transfers/:id", (c) => browserSave(c, "transfers", true));

app.delete("/api/transfers/:id", (c) => browserRemove(c, "transfers"));

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
      version: p.version,
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

app.post("/api/products", (c) => browserSave(c, "products"));

app.put("/api/products/:id", (c) => browserSave(c, "products", true));

app.delete("/api/products/:id", (c) => browserRemove(c, "products"));

// ── Units ──

app.get("/api/units/summary", async (c) => {
  const currency = c.req.query("currency") ?? "CNY";
  if (!["CNY", "USD", "HKD"].includes(currency)) return c.json({ error: "Invalid currency" }, 400);
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
  const summary = buildUnitsSummary(unitsWithAvailability, currency);

  return c.json({ ...summary, currency });
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
      version: u.version,
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
      version: u.version,
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

app.post("/api/units", (c) => browserSave(c, "units"));

app.put("/api/units/:id", (c) => browserSave(c, "units", true));

app.delete("/api/units/:id", (c) => browserRemove(c, "units"));

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
    version: unit.version,
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

app.post("/api/units/:id/commit", (c) => browserCommit(c));

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

app.post("/api/contribution-logs", (c) => browserSave(c, "contribution-logs"));

app.put("/api/contribution-logs/:id", (c) => browserSave(c, "contribution-logs", true));

app.delete("/api/contribution-logs/:id", (c) => browserRemove(c, "contribution-logs"));

app.post("/api/contribution-logs/:id/restore", (c) => browserRestore(c));

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
  const { year, currency = "CNY" } = c.req.query();
  if (!["CNY", "USD", "HKD"].includes(currency)) return c.json({ error: "Invalid currency" }, 400);

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.yearlySummary(userId, parseInt(year, 10), currency);
  return c.json({ ...result, currency });
});

app.get("/api/reports/category-summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year, month, type, currency = "CNY" } = c.req.query();
  if (!["CNY", "USD", "HKD"].includes(currency)) return c.json({ error: "Invalid currency" }, 400);

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.categorySummary(
    userId,
    parseInt(year, 10),
    month ? parseInt(month, 10) : undefined,
    type || undefined,
    currency,
  );
  return c.json({ ...result, currency });
});

app.get("/api/reports/account-summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year, currency = "CNY" } = c.req.query();
  if (!["CNY", "USD", "HKD"].includes(currency)) return c.json({ error: "Invalid currency" }, 400);

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.accountSummary(userId, parseInt(year, 10), currency);
  return c.json({ ...result, currency });
});

app.get("/api/reports/flow-summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year, currency = "CNY" } = c.req.query();
  if (!["CNY", "USD", "HKD"].includes(currency)) return c.json({ error: "Invalid currency" }, 400);

  if (!year) {
    return c.json({ error: "year is required" }, 400);
  }

  const result = await repos.reports.flowSummary(userId, parseInt(year, 10), currency);
  return c.json({ ...result, currency });
});

app.get("/api/reports/monthly-summary", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const { year, month, currency = "CNY" } = c.req.query();
  if (!["CNY", "USD", "HKD"].includes(currency)) return c.json({ error: "Invalid currency" }, 400);

  if (!year || !month) {
    return c.json({ error: "year and month are required" }, 400);
  }

  const result = await repos.reports.monthly(
    userId,
    parseInt(year, 10),
    parseInt(month, 10),
    currency || undefined,
  );
  return c.json({ ...result, currency });
});

// ── Expense Categories (002 spec) ──

app.get("/api/expense-categories", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const categories = await repos.expenseCategories.findAll(userId);
  return c.json({ categories });
});

app.post("/api/expense-categories", (c) => browserSave(c, "expense-categories"));

app.put("/api/expense-categories/:id", (c) => browserSave(c, "expense-categories", true));

app.delete("/api/expense-categories/:id", (c) => browserRemove(c, "expense-categories"));

// ── Recurring Expenses ──

app.get("/api/recurring-expenses", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");
  const rules = await repos.recurringExpenses.findAll(userId);
  return c.json({ rules });
});

app.post("/api/recurring-expenses", (c) => browserSave(c, "recurring-expenses"));

app.put("/api/recurring-expenses/:id", (c) => browserSave(c, "recurring-expenses", true));

app.post("/api/recurring-expenses/:id/state", (c) => browserState(c));

app.delete("/api/recurring-expenses/:id", (c) => browserRemove(c, "recurring-expenses"));

// ── Data Export / Import ──

app.get("/api/data/export", async (c) => {
  const userId = c.get("userId");
  const repos = c.get("repos");

  const [txRows, trRows, products, units] = await Promise.all([
    repos.transactions.findAllByUser(userId),
    repos.transfers.findAllByUser(userId),
    repos.products.findAll(userId),
    repos.units.findAll(userId),
  ]);

  return c.json({
    transactions: txRows,
    transfers: trRows,
    products,
    units,
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
  if (err instanceof ApiError) return problem(c, err);
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON" }, 400);
  console.error(`[Worker Error] ${c.req.method} ${c.req.path}:`, err.name);
  return c.json({ error: "Internal server error" }, 500);
});

// ── Export ──

export default app;
