import { type Context, type Handler, Hono } from "hono";
import { z } from "zod";
import {
  API_RESOURCES,
  API_SCOPES,
  type ApiResource,
  type ApiScope,
  accountClassificationSchema,
  apiKeyCreateSchema,
  balanceAnchorSchema,
  financialPreferencesSchema,
} from "../../src/domain/api-contract";
import { computeOccurrences } from "../../src/lib/recurring-expense/occurrences";
import type { RecurrenceRule } from "../../src/lib/recurring-expense/rule-types";
import {
  commitUnitSchema,
  createTransactionSchema,
  createTransferSchema,
  expectedUnitSchema,
  updateTransactionSchema,
  updateTransferSchema,
  updateUnitSchema,
} from "../db/validation";
import { computeAvailability } from "../lib/availability";
import { isRecurringStatus, patchForTransition } from "../lib/recurring-state";
import { buildCommitStatements, type SwapTarget } from "../lib/unit-commit";
import {
  ApiError,
  canonical,
  checkedRead,
  owned,
  prepareFinancialData,
  type Row,
  references,
  resources,
  rowStatement,
  type Sql,
  sha256,
  validated,
  wire,
} from "./financial-service";
import type { AppEnv } from "./index";

type Principal = {
  owner: string;
  kind: "human" | "apiKey";
  keyId: string | null;
  scopes: ApiScope[];
};
const principals = new WeakMap<object, Principal>();
const requests = new WeakMap<object, string>();
type C = Context<AppEnv>;
const principal = (c: C): Principal =>
  principals.get(c) ?? {
    owner: c.get("userId"),
    kind: "human",
    keyId: null,
    scopes: [...API_SCOPES],
  };
const requestId = (c: C) => requests.get(c) ?? crypto.randomUUID();
const db = (c: C) => c.get("d1");
const nowIso = () => new Date().toISOString();
function result(c: C, data: unknown, meta: Row = {}, status: 200 | 201 = 200) {
  return c.json({ data, meta: { requestId: requestId(c), ...meta } }, status);
}
function requireScopes(c: C, scopes: readonly string[]) {
  const missing = scopes.filter((scope) => !principal(c).scopes.includes(scope as ApiScope));
  if (missing.length) throw new ApiError(403, "insufficient_scope", { missingScopes: missing });
}
async function json(c: C): Promise<unknown> {
  if (!c.req.header("Content-Type")?.toLowerCase().startsWith("application/json"))
    throw new ApiError(415, "unsupported_media_type");
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(400, "invalid_json");
  }
}
function ifMatch(c: C): number {
  const value = c.req.header("If-Match");
  if (value === undefined) throw new ApiError(428, "if_match_required");
  if (!/^"(?:0|[1-9]\d*)"$/.test(value)) throw new ApiError(400, "invalid_if_match");
  const version = Number(value.slice(1, -1));
  if (!Number.isSafeInteger(version)) throw new ApiError(400, "invalid_if_match");
  return version;
}
export function beginApiRequest(c: C) {
  if (!requests.has(c)) requests.set(c, crypto.randomUUID());
  c.header("X-Request-Id", requestId(c));
  c.header("Cache-Control", "no-store");
}
export function problem(c: C, error: unknown): Response {
  const failure = error instanceof ApiError ? error : new ApiError(500, "internal_error");
  if (!(error instanceof ApiError)) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      JSON.stringify({
        level: "error",
        requestId: requestId(c),
        method: c.req.method,
        path: c.req.path,
        name: err.name,
        message: err.message,
        stack: err.stack,
      }),
    );
  }
  if (failure.status === 401) c.header("WWW-Authenticate", "Bearer");
  if (failure.status === 429) c.header("Retry-After", "60");
  return c.json(
    {
      type: `https://noheir.hexly.ai/problems/${failure.code}`,
      title: failure.code.replaceAll("_", " "),
      status: failure.status,
      code: failure.code,
      requestId: requestId(c),
      ...(failure.fields ? { errors: failure.fields } : {}),
    },
    failure.status,
    { "Content-Type": "application/problem+json" },
  );
}
function setup(app: Hono<AppEnv>) {
  app.use("*", async (c, next) => {
    beginApiRequest(c);
    await next();
  });
  app.onError((error, c) => problem(c, error));
}
async function authenticate(c: C): Promise<Principal> {
  const header = c.req.header("Authorization");
  const url = new URL(c.req.url);
  const local =
    url.origin === new URL(c.env.SITE_URL).origin &&
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !local) ||
    !header ||
    !/^Bearer nhk_[A-Za-z0-9_-]{43}$/.test(header)
  )
    throw new ApiError(401, "invalid_credentials");
  const token = header.slice(7);
  const row = await db(c)
    .prepare("SELECT * FROM api_keys WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?")
    .bind(await sha256(token), Date.now())
    .first<Row>();
  if (!row) throw new ApiError(401, "invalid_credentials");
  let scopes: unknown;
  try {
    scopes = JSON.parse(String(row.scopes));
  } catch {
    throw new ApiError(401, "invalid_credentials");
  }
  const parsed = apiKeyCreateSchema.shape.scopes.safeParse(scopes);
  if (!parsed.success) throw new ApiError(401, "invalid_credentials");
  await db(c)
    .prepare(
      "UPDATE api_keys SET last_used_at=? WHERE id=? AND (last_used_at IS NULL OR last_used_at<?)",
    )
    .bind(Date.now(), row.id, Date.now() - 60000)
    .run();
  return {
    owner: String(row.owner_id),
    kind: "apiKey",
    keyId: String(row.id),
    scopes: parsed.data,
  };
}
const RATE_LIMITS = {
  windowSeconds: 60,
  keyRequests: 120,
  ownerRequests: 600,
  keyExpensive: 20,
  ownerExpensive: 60,
  lastUsedWriteSeconds: 60,
};
async function rateLimit(c: C) {
  const p = principal(c),
    window = Math.floor(Date.now() / 60000) * 60000;
  const expensive =
    /\/(aggregate|portfolio|balances|occurrences|metadata)$/.test(c.req.path) ||
    c.req.path.includes("/ledger-replacements");
  const budgets = [
    { subject: `key:${p.keyId}`, budget: "requests", limit: RATE_LIMITS.keyRequests },
    { subject: `owner:${p.owner}`, budget: "requests", limit: RATE_LIMITS.ownerRequests },
    ...(expensive
      ? [
          { subject: `key:${p.keyId}`, budget: "expensive", limit: RATE_LIMITS.keyExpensive },
          { subject: `owner:${p.owner}`, budget: "expensive", limit: RATE_LIMITS.ownerExpensive },
        ]
      : []),
  ];
  const results = await db(c).batch<Row>([
    db(c)
      .prepare("DELETE FROM api_rate_limits WHERE window_start<?")
      .bind(window - 60000),
    ...budgets.map((b) =>
      db(c)
        .prepare(
          "INSERT INTO api_rate_limits(subject,budget,window_start,count) VALUES(?,?,?,1) ON CONFLICT(subject,budget,window_start) DO UPDATE SET count=count+1 RETURNING count",
        )
        .bind(b.subject, b.budget, window),
    ),
  ]);
  if (budgets.some((b, i) => Number(results[i + 1]?.results[0]?.count) > b.limit))
    throw new ApiError(429, "rate_limit_exceeded");
}
function keyInfo(row: Row) {
  return {
    id: row.id,
    label: row.label,
    prefix: row.prefix,
    scopes: JSON.parse(String(row.scopes)),
    createdAt: new Date(Number(row.created_at)).toISOString(),
    expiresAt: new Date(Number(row.expires_at)).toISOString(),
    revokedAt: row.revoked_at == null ? null : new Date(Number(row.revoked_at)).toISOString(),
    lastUsedAt: row.last_used_at == null ? null : new Date(Number(row.last_used_at)).toISOString(),
  };
}
function auditKey(c: C, id: string, operation: string): D1PreparedStatement {
  const p = principal(c);
  return db(c)
    .prepare(
      "INSERT INTO api_audit(id,owner_id,actor_kind,key_id,request_id,operation,resource,resource_id,created_at) VALUES(?,?,'human',NULL,?,?,'api-keys',?,?)",
    )
    .bind(crypto.randomUUID(), p.owner, requestId(c), operation, id, Date.now());
}
type Plan = { statements: Sql[]; precondition?: Sql; data: Row; status: 200 | 201 };
async function mutate(
  c: C,
  resource: string,
  input: unknown,
  build: (token: string) => Promise<Plan>,
): Promise<Response> {
  const p = principal(c);
  const key = c.req.header("Idempotency-Key");
  if (p.kind === "apiKey" && (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)))
    throw new ApiError(
      key ? 400 : 428,
      key ? "invalid_idempotency_key" : "idempotency_key_required",
    );
  const fingerprint = await sha256(
    canonical({
      method: c.req.method,
      path: c.req.path,
      input,
      ifMatch: c.req.header("If-Match") ?? null,
    }),
  );
  const replay = async () => {
    if (p.kind !== "apiKey") return null;
    const record = await db(c)
      .prepare(
        "SELECT * FROM api_idempotency WHERE owner_id=? AND key_id=? AND value=? AND expires_at>?",
      )
      .bind(p.owner, p.keyId, key, Date.now())
      .first<Row>();
    if (!record) return null;
    if (record.fingerprint !== fingerprint) throw new ApiError(409, "idempotency_conflict");
    return result(c, JSON.parse(String(record.response)), {}, Number(record.status) as 200 | 201);
  };
  const previous = await replay();
  if (previous) return previous;
  const token = crypto.randomUUID();
  let plan: Plan;
  try {
    plan = await build(token);
  } catch (error) {
    const completed = await replay();
    if (completed) return completed;
    throw error;
  }
  const timestamp = Date.now();
  const guard = "EXISTS(SELECT 1 FROM api_mutation_context WHERE owner_id=? AND token=?)";
  const guardParams = [p.owner, token];
  const precondition = plan.precondition ?? { sql: "1", params: [] };
  const statements: Sql[] = [];
  if (p.kind === "apiKey")
    statements.push({
      sql: "DELETE FROM api_idempotency WHERE owner_id=? AND key_id=? AND value=? AND expires_at<=?",
      params: [p.owner, p.keyId, key, timestamp],
    });
  const contextIndex = statements.length;
  statements.push({
    sql: `INSERT INTO api_mutation_context(owner_id,request_id,actor_kind,key_id,operation,token) SELECT ?,?,?,?,?,? WHERE (${precondition.sql}) ${p.kind === "apiKey" ? "AND NOT EXISTS(SELECT 1 FROM api_idempotency WHERE owner_id=? AND key_id=? AND value=?)" : ""}`,
    params: [
      p.owner,
      requestId(c),
      p.kind,
      p.keyId,
      `${resource}.${c.req.method.toLowerCase()}`,
      token,
      ...precondition.params,
      ...(p.kind === "apiKey" ? [p.owner, p.keyId, key] : []),
    ],
  });
  for (const statement of plan.statements)
    statements.push({
      sql: statement.sql.replaceAll("$GUARD", guard),
      params: statement.params.flatMap((value) =>
        value === "$GUARD_PARAMS" ? guardParams : [value],
      ),
    });
  if (p.kind === "apiKey")
    statements.push({
      sql: `INSERT INTO api_idempotency(owner_id,key_id,value,fingerprint,response,status,expires_at) SELECT ?,?,?,?,?,?,? WHERE ${guard}`,
      params: [
        p.owner,
        p.keyId,
        key,
        fingerprint,
        JSON.stringify(plan.data),
        plan.status,
        timestamp + 7 * 86400000,
        ...guardParams,
      ],
    });
  statements.push({
    sql: "DELETE FROM api_mutation_context WHERE owner_id=? AND token=?",
    params: guardParams,
  });
  let batch: D1Result[];
  try {
    batch = await db(c).batch(
      statements.map((s) =>
        db(c)
          .prepare(s.sql)
          .bind(...s.params),
      ),
    );
  } catch (error) {
    if (/constraint|unique|foreign key|business_conflict/i.test(String(error)))
      throw new ApiError(409, "business_conflict");
    throw error;
  }
  if (!batch[contextIndex]?.meta.changes) {
    const retried = await replay();
    if (retried) return retried;
    throw new ApiError(
      plan.precondition ? 412 : 409,
      plan.precondition ? "stale_version" : "business_conflict",
    );
  }
  return result(c, plan.data, {}, plan.status);
}
function versionPrecondition(
  resource: ApiResource,
  owner: string,
  id: string,
  version: number,
): Sql {
  return {
    sql: `EXISTS(SELECT 1 FROM ${resources[resource].table} WHERE user_id=? AND id=? AND version=?)`,
    params: [owner, id, version],
  };
}
const guardArgs = ["$GUARD_PARAMS"];
async function save(
  c: C,
  resource: ApiResource,
  update = false,
  provided?: unknown,
): Promise<Response> {
  requireScopes(c, [`${resource}:write`]);
  const input = validated(resource, provided ?? (await json(c)), update);
  if (
    resource === "units" &&
    update &&
    principal(c).kind === "apiKey" &&
    ["amountCents", "productId", "status", "currency"].some((field) => Object.hasOwn(input, field))
  )
    throw new ApiError(409, "unit_commit_required");
  if (resource === "analyses" && Array.isArray(input.evidence))
    for (const evidence of input.evidence as { resource: ApiResource }[])
      requireScopes(c, [`${evidence.resource}:read`]);
  const version = update ? ifMatch(c) : 0;
  const creationFingerprint = await sha256(canonical(input));
  const execute = () =>
    mutate(c, resource, input, async () => {
      const p = principal(c),
        timestamp = Date.now(),
        id = update
          ? (c.req.param("id") as string)
          : resource === "financial-preferences"
            ? p.owner
            : crypto.randomUUID();
      if (resource === "analyses" && !update && typeof input.externalId === "string") {
        const prior = await db(c)
          .prepare("SELECT * FROM analysis_creation_receipts WHERE owner_id=? AND external_id=?")
          .bind(p.owner, input.externalId)
          .first<Row>();
        if (prior) {
          if (prior.fingerprint !== creationFingerprint)
            throw new ApiError(409, "external_id_conflict");
          return { statements: [], data: JSON.parse(String(prior.response)) as Row, status: 201 };
        }
      }
      const existing = update ? await owned(db(c), resource, p.owner, id) : undefined;
      await references(db(c), resource, p.owner, input, existing);
      const data = prepareFinancialData(resource, input, timestamp, !update, p);
      const statements = [
        rowStatement(resources[resource].table, id, p.owner, data, "$GUARD", guardArgs, update),
      ];
      if (resource === "units" && !update && input.productId && input.status === "已成立") {
        const product = await owned(db(c), "products", p.owner, String(input.productId));
        statements.push(
          rowStatement(
            "contribution_logs",
            crypto.randomUUID(),
            p.owner,
            {
              unitId: id,
              productId: input.productId,
              productName: product.name,
              operationType: "invest",
              amountCents: input.amountCents,
              operationDate:
                input.startDate ??
                new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }),
              source: "auto",
              note: "Auto: initial investment on unit creation",
              createdAt: Math.floor(timestamp / 1000),
              updatedAt: Math.floor(timestamp / 1000),
            },
            "$GUARD",
            guardArgs,
          ),
        );
      }
      if (resource === "analyses" && !update && typeof input.externalId === "string")
        statements.push({
          sql: "INSERT INTO analysis_creation_receipts(owner_id,external_id,fingerprint,response,created_at) SELECT ?,?,?,?,? WHERE $GUARD",
          params: [
            p.owner,
            input.externalId,
            creationFingerprint,
            JSON.stringify({ id, version: 1, affected: 1 }),
            timestamp,
            ...guardArgs,
          ],
        });
      return {
        statements,
        ...(update ? { precondition: versionPrecondition(resource, p.owner, id, version) } : {}),
        data: { id, version: version + 1, affected: 1 },
        status: update ? 200 : 201,
      };
    });
  try {
    return await execute();
  } catch (error) {
    if (
      resource === "analyses" &&
      !update &&
      typeof input.externalId === "string" &&
      error instanceof ApiError &&
      error.code === "business_conflict"
    ) {
      const receipt = await db(c)
        .prepare(
          "SELECT fingerprint FROM analysis_creation_receipts WHERE owner_id=? AND external_id=?",
        )
        .bind(principal(c).owner, input.externalId)
        .first<Row>();
      if (receipt?.fingerprint === creationFingerprint) return execute();
    }
    throw error;
  }
}
async function remove(c: C, resource: ApiResource): Promise<Response> {
  requireScopes(c, [`${resource}:delete`]);
  const version = ifMatch(c);
  return mutate(c, resource, null, async () => {
    const p = principal(c),
      id = c.req.param("id") as string;
    await owned(db(c), resource, p.owner, id);
    const referencesToCheck =
      resource === "products"
        ? [
            ["capital_units", "product_id"],
            ["contribution_logs", "product_id"],
          ]
        : [];
    for (const [table, column] of referencesToCheck)
      if (
        await db(c)
          .prepare(`SELECT 1 FROM ${table} WHERE user_id=? AND ${column}=? LIMIT 1`)
          .bind(p.owner, id)
          .first()
      )
        throw new ApiError(409, "resource_referenced");
    if (
      resource === "units" &&
      (await db(c)
        .prepare("SELECT 1 FROM contribution_logs WHERE user_id=? AND unit_id=? LIMIT 1")
        .bind(p.owner, id)
        .first())
    )
      requireScopes(c, ["contribution-logs:delete"]);
    if (
      resource === "expense-categories" &&
      (await db(c)
        .prepare("SELECT 1 FROM recurring_expenses WHERE user_id=? AND category_id=? LIMIT 1")
        .bind(p.owner, id)
        .first())
    )
      requireScopes(c, ["recurring-expenses:write"]);
    const statements: Sql[] =
      resource === "contribution-logs"
        ? [
            {
              sql: "UPDATE contribution_logs SET deleted_at=?,updated_at=? WHERE id=? AND user_id=? AND $GUARD",
              params: [
                Math.floor(Date.now() / 1000),
                Math.floor(Date.now() / 1000),
                id,
                p.owner,
                ...guardArgs,
              ],
            },
          ]
        : [
            {
              sql: `DELETE FROM ${resources[resource].table} WHERE id=? AND user_id=? AND $GUARD`,
              params: [id, p.owner, ...guardArgs],
            },
          ];
    const precondition = versionPrecondition(resource, p.owner, id, version);
    for (const [table, column] of referencesToCheck) {
      precondition.sql += ` AND NOT EXISTS(SELECT 1 FROM ${table} WHERE user_id=? AND ${column}=?)`;
      precondition.params.push(p.owner, id);
    }
    if (resource === "units" && !p.scopes.includes("contribution-logs:delete")) {
      precondition.sql +=
        " AND NOT EXISTS(SELECT 1 FROM contribution_logs WHERE user_id=? AND unit_id=?)";
      precondition.params.push(p.owner, id);
    }
    if (resource === "expense-categories" && !p.scopes.includes("recurring-expenses:write")) {
      precondition.sql +=
        " AND NOT EXISTS(SELECT 1 FROM recurring_expenses WHERE user_id=? AND category_id=?)";
      precondition.params.push(p.owner, id);
    }
    return {
      statements,
      precondition,
      data: { id, version: version + 1, affected: 1 },
      status: 200,
    };
  });
}
function encodeCursor(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
function decodeCursor(value: string): string {
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
    Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) =>
      char.charCodeAt(0),
    ),
  );
}
const listQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().max(8000).optional(),
  total: z.enum(["true", "false"]).default("false"),
  currency: z.enum(["CNY", "USD", "HKD"]).optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  account: z.string().max(200).optional(),
  tag: z.string().max(200).optional(),
  type: z.enum(["income", "expense"]).optional(),
  category: z.string().max(200).optional(),
  status: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
  minAmountCents: z.coerce.number().int().optional(),
  maxAmountCents: z.coerce.number().int().optional(),
  includeDeleted: z.enum(["true", "false"]).default("false"),
  groupBy: z.enum(["currency", "month", "category", "account", "tag"]).optional(),
});
function filters(c: C, resource: ApiResource) {
  const query = listQuerySchema.safeParse(c.req.query());
  if (!query.success) throw new ApiError(400, "invalid_query");
  const q = query.data;
  if (q.startDate && q.endDate && q.startDate > q.endDate)
    throw new ApiError(400, "invalid_date_interval");
  if (
    q.minAmountCents !== undefined &&
    q.maxAmountCents !== undefined &&
    q.minAmountCents > q.maxAmountCents
  )
    throw new ApiError(400, "invalid_amount_interval");
  const p = principal(c),
    conditions = ["r.user_id=?"],
    params: unknown[] = [p.owner];
  const dateColumn =
    resource === "contribution-logs"
      ? "operation_date"
      : resource === "recurring-expenses"
        ? "start_date"
        : "date";
  const columns = new Set(
    Object.keys(resources[resource].schema.shape).map((key) =>
      key.replace(/[A-Z]/g, (s) => `_${s.toLowerCase()}`),
    ),
  );
  if (resource === "contribution-logs" && q.includeDeleted !== "true")
    conditions.push("r.deleted_at IS NULL");
  for (const [key, column, operator, value] of [
    ["currency", "currency", "=", q.currency],
    ["account", "account", "=", q.account],
    ["type", "type", "=", q.type],
    ["category", "primary_category", "=", q.category],
    ["status", "status", "=", q.status],
    ["startDate", dateColumn, ">=", q.startDate],
    ["endDate", dateColumn, "<=", q.endDate],
    ["minAmountCents", "amount_cents", ">=", q.minAmountCents],
    ["maxAmountCents", "amount_cents", "<=", q.maxAmountCents],
  ] as const) {
    if (value === undefined) continue;
    if (resource === "analyses" && key === "currency") {
      conditions.push("EXISTS(SELECT 1 FROM json_each(r.currencies) WHERE value=?)");
      params.push(value);
      continue;
    }
    if (resource === "analyses" && (key === "startDate" || key === "endDate")) {
      conditions.push(key === "startDate" ? "r.period_end>=?" : "r.period_start<=?");
      params.push(value);
      continue;
    }
    if (
      !columns.has(column) &&
      !(column === "status" && (resource === "units" || resource === "recurring-expenses"))
    )
      throw new ApiError(400, `unsupported_filter_${key}`);
    conditions.push(`r.${column} ${operator} ?`);
    params.push(value);
  }
  if (q.tag !== undefined) {
    if (!columns.has("tags")) throw new ApiError(400, "unsupported_filter_tag");
    conditions.push("EXISTS(SELECT 1 FROM json_each(r.tags) WHERE value=?)");
    params.push(q.tag);
  }
  if (q.q !== undefined) {
    const column = columns.has("name") ? "name" : columns.has("title") ? "title" : "note";
    if (!columns.has(column)) throw new ApiError(400, "unsupported_filter_q");
    conditions.push(`instr(lower(coalesce(r.${column},'')),lower(?))>0`);
    params.push(q.q);
  }
  return { query: q, where: conditions.join(" AND "), params };
}
async function list(c: C, resource: ApiResource): Promise<Response> {
  requireScopes(c, [`${resource}:read`]);
  const { query, where, params } = filters(c, resource);
  const p = principal(c);
  const { cursor: _cursor, ...normalized } = query;
  void _cursor;
  const binding = canonical({
    owner: p.owner,
    key: p.keyId,
    resource,
    filters: normalized,
    order: "id:desc",
  });
  let cursor: { binding: string; revision: number; id: string } | undefined;
  if (query.cursor) {
    try {
      const decoded = JSON.parse(decodeCursor(query.cursor));
      const parsed = z
        .strictObject({
          binding: z.string(),
          revision: z.number().int().nonnegative(),
          id: z.string().min(1).max(200),
        })
        .safeParse(decoded);
      if (!parsed.success || parsed.data.binding !== binding) throw new Error();
      cursor = parsed.data;
    } catch {
      throw new ApiError(400, "invalid_cursor");
    }
  }
  const table = resources[resource].table;
  const statements: Sql[] = [
    {
      sql: `SELECT r.* FROM ${table} r WHERE ${where}${cursor ? " AND r.id<?" : ""} ORDER BY r.id DESC LIMIT ?`,
      params: [...params, ...(cursor ? [cursor.id] : []), query.limit + 1],
    },
  ];
  if (query.total === "true")
    statements.push({ sql: `SELECT count(*) total FROM ${table} r WHERE ${where}`, params });
  const read = await checkedRead(db(c), p.owner, statements, resource === "analyses");
  if (cursor && cursor.revision !== read.revision) throw new ApiError(409, "dataset_changed");
  const all = read.results[0] ?? [];
  const rows = all.slice(0, query.limit),
    hasMore = all.length > query.limit;
  return result(c, rows.map(wire), {
    returned: rows.length,
    hasMore,
    nextCursor: hasMore
      ? encodeCursor(JSON.stringify({ binding, revision: read.revision, id: rows.at(-1)?.id }))
      : null,
    dataRevision: read.revision,
    asOf: nowIso(),
    filters: normalized,
    ...(query.total === "true" ? { total: read.results[1]?.[0]?.total } : {}),
  });
}
async function detail(c: C, resource: ApiResource): Promise<Response> {
  requireScopes(c, [`${resource}:read`]);
  const p = principal(c);
  const read = await checkedRead(
    db(c),
    p.owner,
    [
      {
        sql: `SELECT * FROM ${resources[resource].table} WHERE user_id=? AND id=? ${resource === "contribution-logs" ? "AND deleted_at IS NULL" : ""}`,
        params: [p.owner, c.req.param("id")],
      },
    ],
    resource === "analyses",
  );
  const row = read.results[0]?.[0];
  if (!row) throw new ApiError(404, "not_found");
  c.header("ETag", `"${row.version}"`);
  return result(c, wire(row), { dataRevision: read.revision });
}
async function aggregate(c: C, resource: "transactions" | "transfers"): Promise<Response> {
  requireScopes(c, [`${resource}:read`]);
  const f = filters(c, resource);
  const grouping = f.query.groupBy ?? "currency";
  const groupExpressions = {
    currency: "r.currency",
    month: "substr(r.date,1,7)",
    category: "r.primary_category",
    account: "r.account",
    tag: "j.value",
  };
  const group = groupExpressions[grouping];
  const sum =
    resource === "transactions"
      ? "sum(r.amount_cents) amount_cents"
      : "sum(r.inflow_amount_cents) inflow_amount_cents,sum(r.outflow_amount_cents) outflow_amount_cents";
  const read = await checkedRead(db(c), principal(c).owner, [
    {
      sql: `SELECT r.currency,${group} group_value,count(*) count,${sum} FROM ${resources[resource].table} r ${grouping === "tag" ? "JOIN json_each(r.tags) j" : ""} WHERE ${f.where} GROUP BY r.currency,${group} ORDER BY r.currency,${group} LIMIT 501`,
      params: f.params,
    },
  ]);
  const rows = read.results[0] ?? [];
  if (rows.length > 500) throw new ApiError(400, "aggregate_too_many_groups");
  for (const row of rows)
    for (const value of Object.values(row))
      if (typeof value === "number" && !Number.isSafeInteger(value))
        throw new ApiError(409, "aggregate_overflow");
  return result(c, rows.map(wire), {
    dataRevision: read.revision,
    returned: rows.length,
    asOf: nowIso(),
    filters: f.query,
    groupBy: grouping,
    overlapping: grouping === "tag",
  });
}
function registerResources(app: Hono<AppEnv>, human = false) {
  const api = human ? app : documented(app);
  for (const resource of API_RESOURCES) {
    if (resource === "financial-preferences") continue;
    if (
      human &&
      !(["analyses", "account-classifications", "balance-anchors"] as string[]).includes(resource)
    )
      continue;
    api.get(`/${resource}`, (c) => list(c, resource));
    api.post(`/${resource}`, (c) => save(c, resource));
    api.get(`/${resource}/:id`, (c) => detail(c, resource));
    api.patch(`/${resource}/:id`, (c) => save(c, resource, true));
    api.delete(`/${resource}/:id`, (c) => remove(c, resource));
    app.all(`/${resource}`, (c) => {
      c.header("Allow", "GET, POST");
      throw new ApiError(405, "method_not_allowed");
    });
    app.all(`/${resource}/:id`, (c) => {
      c.header("Allow", "GET, PATCH, DELETE");
      throw new ApiError(405, "method_not_allowed");
    });
  }
  api.get("/financial-preferences", async (c) => {
    requireScopes(c, ["financial-preferences:read"]);
    const p = principal(c);
    const read = await checkedRead(db(c), p.owner, [
      { sql: "SELECT * FROM financial_preferences WHERE user_id=?", params: [p.owner] },
    ]);
    const row = read.results[0]?.[0];
    c.header("ETag", `"${row?.version ?? 0}"`);
    return result(
      c,
      row
        ? wire(row)
        : {
            ...financialPreferencesSchema.parse({}),
            id: p.owner,
            version: 0,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
      { dataRevision: read.revision },
    );
  });
  const preferences = async (c: C) => {
    requireScopes(c, ["financial-preferences:write"]);
    const input = validated("financial-preferences", await json(c), c.req.method === "PATCH");
    const version = ifMatch(c);
    return mutate(c, "financial-preferences", input, async () => {
      const p = principal(c);
      const exists = await db(c)
        .prepare("SELECT * FROM financial_preferences WHERE user_id=?")
        .bind(p.owner)
        .first<Row>();
      const merged = financialPreferencesSchema.safeParse({
        ...financialPreferencesSchema.parse({}),
        ...(exists ? wire(exists) : {}),
        ...input,
        id: undefined,
        version: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      });
      const data = Object.fromEntries(
        Object.entries({
          ...financialPreferencesSchema.parse({}),
          ...(exists ? wire(exists) : {}),
          ...input,
        }).filter(([key]) => key in financialPreferencesSchema.shape),
      );
      if (!financialPreferencesSchema.safeParse(data).success)
        throw new ApiError(400, "invalid_preferences");
      void merged;
      return {
        statements: [
          rowStatement(
            "financial_preferences",
            p.owner,
            p.owner,
            prepareFinancialData("financial-preferences", data, Date.now(), !exists, p),
            "$GUARD",
            guardArgs,
            !!exists,
          ),
        ],
        precondition: exists
          ? versionPrecondition("financial-preferences", p.owner, p.owner, version)
          : {
              sql: "?=0 AND NOT EXISTS(SELECT 1 FROM financial_preferences WHERE user_id=?)",
              params: [version, p.owner],
            },
        data: { id: p.owner, version: version + 1, affected: 1 },
        status: 200,
      };
    });
  };
  api.put("/financial-preferences", preferences);
  api.patch("/financial-preferences", preferences);
  api.delete("/financial-preferences", async (c) => {
    requireScopes(c, ["financial-preferences:delete"]);
    const version = ifMatch(c);
    return mutate(c, "financial-preferences", null, async () => {
      const p = principal(c);
      await owned(db(c), "financial-preferences", p.owner, p.owner);
      return {
        statements: [
          rowStatement(
            "financial_preferences",
            p.owner,
            p.owner,
            { ...financialPreferencesSchema.parse({}), updatedAt: Date.now() },
            "$GUARD",
            guardArgs,
            true,
          ),
        ],
        precondition: versionPrecondition("financial-preferences", p.owner, p.owner, version),
        data: { id: p.owner, version: version + 1, affected: 1 },
        status: 200,
      };
    });
  });
}
export function createHumanApi() {
  const app = new Hono<AppEnv>();
  setup(app);
  app.use("*", async (c, next) => {
    if (c.req.header("Authorization")) throw new ApiError(401, "human_authentication_required");
    await next();
  });
  app.get("/api-keys", async (c) => {
    const rows = await db(c)
      .prepare("SELECT * FROM api_keys WHERE owner_id=? ORDER BY created_at DESC,id DESC")
      .bind(principal(c).owner)
      .all<Row>();
    return result(c, rows.results.map(keyInfo), { returned: rows.results.length });
  });
  app.post("/api-keys", async (c) => {
    const parsed = apiKeyCreateSchema.safeParse(await json(c));
    if (!parsed.success) throw new ApiError(400, "invalid_key_input");
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = `nhk_${btoa(String.fromCharCode(...bytes))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "")}`;
    const now = Date.now(),
      id = crypto.randomUUID();
    const row = {
      id,
      owner_id: principal(c).owner,
      label: parsed.data.label,
      prefix: token.slice(0, 12),
      token_hash: await sha256(token),
      scopes: JSON.stringify(parsed.data.scopes),
      created_at: now,
      expires_at: now + parsed.data.expiresInDays * 86400000,
      revoked_at: null,
      last_used_at: null,
    };
    await db(c).batch([
      db(c)
        .prepare(
          `INSERT INTO api_keys(${Object.keys(row).join(",")}) VALUES(${Object.keys(row)
            .map(() => "?")
            .join(",")})`,
        )
        .bind(...Object.values(row)),
      auditKey(c, id, "api-keys.create"),
    ]);
    return result(c, { ...keyInfo(row), token }, {}, 201);
  });
  app.delete("/api-keys/:id", async (c) => {
    const id = c.req.param("id");
    const existing = await db(c)
      .prepare("SELECT id FROM api_keys WHERE owner_id=? AND id=?")
      .bind(principal(c).owner, id)
      .first();
    if (!existing) throw new ApiError(404, "not_found");
    await db(c).batch([
      db(c)
        .prepare("UPDATE api_keys SET revoked_at=coalesce(revoked_at,?) WHERE owner_id=? AND id=?")
        .bind(Date.now(), principal(c).owner, id),
      auditKey(c, id, "api-keys.revoke"),
    ]);
    return result(c, { id, revoked: true });
  });
  for (const resource of ["account-classifications", "balance-anchors"] as const)
    app.put(`/${resource}`, async (c) => {
      const schema =
        resource === "account-classifications" ? accountClassificationSchema : balanceAnchorSchema;
      const parsed = z.strictObject({ items: z.array(schema).max(500) }).safeParse(await json(c));
      if (!parsed.success) throw new ApiError(400, "invalid_collection");
      const items = parsed.data.items as Row[],
        version = ifMatch(c),
        p = principal(c),
        now = Date.now();
      const natural = (item: Row) =>
        resource === "account-classifications"
          ? String(item.accountName)
          : canonical([item.accountName, item.currency, item.date]);
      if (new Set(items.map(natural)).size !== items.length)
        throw new ApiError(400, "duplicate_collection_key");
      return mutate(c, resource, items, async () => {
        const current = (
          await db(c)
            .prepare(`SELECT * FROM ${resources[resource].table} WHERE user_id=?`)
            .bind(p.owner)
            .all<Row>()
        ).results;
        const statements: Sql[] = [],
          ids: string[] = [];
        for (const item of items) {
          const existing = current.find((row) => natural(wire(row)) === natural(item));
          const id = existing
            ? String(existing.id)
            : await sha256(`${resource}:${p.owner}:${natural(item)}`);
          ids.push(id);
          statements.push(
            rowStatement(
              resources[resource].table,
              id,
              p.owner,
              { ...item, ...(!existing ? { createdAt: now } : {}), updatedAt: now },
              "$GUARD",
              guardArgs,
              !!existing,
            ),
          );
        }
        const removed = current.filter((row) => !ids.includes(String(row.id)));
        for (const row of removed)
          statements.push({
            sql: `DELETE FROM ${resources[resource].table} WHERE id=? AND user_id=? AND $GUARD`,
            params: [row.id, p.owner, ...guardArgs],
          });
        return {
          statements,
          precondition: {
            sql: "coalesce((SELECT revision FROM owner_revisions WHERE owner_id=?),0)=?",
            params: [p.owner, version],
          },
          data: {
            id: resource,
            version: version + items.length + removed.length,
            affected: items.length + removed.length,
          },
          status: 200,
        };
      });
    });
  registerResources(app, true);
  return app;
}
export function createMachineApi() {
  const app = new Hono<AppEnv>();
  setup(app);
  const api = documented(app);
  api.get("/openapi.json", (c) => c.json(openapi(app)));
  api.get("/instructions", (c) => c.json(instructions));
  app.use("*", async (c, next) => {
    principals.set(c, await authenticate(c));
    await rateLimit(c);
    enforceMethod(app, c);
    await next();
  });
  api.get("/me", async (c) => {
    const p = principal(c);
    const row = await db(c).prepare("SELECT * FROM api_keys WHERE id=?").bind(p.keyId).first<Row>();
    return result(c, { ...keyInfo(row as Row), ownerId: p.owner });
  });
  api.get("/capabilities", (c) =>
    result(c, {
      schemaVersion: "1",
      scopes: principal(c).scopes,
      limits: {
        defaultPageSize: 100,
        maxPageSize: 500,
        maxBatchSize: 100,
        idempotencyDays: 7,
        rateLimits: RATE_LIMITS,
      },
      conventions: {
        money: "safe integer cents",
        rates: "percentage points",
        timeZone: "Asia/Shanghai",
        currencies: ["CNY", "USD", "HKD"],
        order: "id descending",
        consistency: "restart traversal on dataset_changed",
      },
    }),
  );
  api.get("/transactions/aggregate", (c) => aggregate(c, "transactions"));
  api.get("/transfers/aggregate", (c) => aggregate(c, "transfers"));
  registerQueries(app);
  registerOperations(app);
  registerResources(app);
  app.all("*", () => {
    throw new ApiError(404, "not_found");
  });
  return app;
}
export function listMachineApiRoutes(): string[] {
  const mount = new Hono<AppEnv>();
  mount.route("/api/v1", createMachineApi());
  return [
    ...new Set(
      mount.routes
        .filter((route) => route.path.startsWith("/api/v1/") && route.method !== "ALL")
        .map((route) => `${route.method} ${route.path.replace(/:([^/]+)/g, "{$1}")}`),
    ),
  ].sort();
}
const instructions = {
  version: "1",
  authentication:
    "Use one HTTPS Authorization: Bearer nhk_... header. Never send keys in URLs. Access sessions do not authenticate this API.",
  reads:
    "Read scopes are independent. Follow nextCursor until hasMore=false. All pages bind the authenticated key, filters and dataRevision. Restart on 409 dataset_changed. No historical snapshot is promised.",
  money:
    "All money is signed safe integer cents. Currency totals never mix. No FX conversion. Transfer rows are separate from income and expense. Missing anchors or investment history are unknown, not zero.",
  writes:
    'Send Idempotency-Key on every mutation. Read resource version and send If-Match: "version" on updates/deletes/operations. Retry uncertain requests with identical input/key within seven days. Resolve 412 by rereading, never silently overwrite. Write grants do not disclose records. Source/provenance/owner are server assigned.',
  audit:
    "Audit pagination uses an owner append-count auditRevision, separate from financial dataRevision. Any financial, report or key audit addition invalidates a cursor; restart on dataset_changed. Cursors bind the authenticated key and page limit.",
  reports:
    "Reports are private externally authored Markdown. author/model labels are unverified claims, not inference. dataRevision/evidence identify the source dataset; reread current revision to label staleness.",
  replacement:
    "Preview exact resources/year/rows and explicit allowEmpty. Commit the same payload and returned digest at expectedDataRevision. Requires data:replace and read/write/delete for every affected ledger.",
  limits: {
    pageSize: 500,
    batchRows: 100,
    replacementRows: 500,
    aggregateGroups: 500,
    occurrenceDays: 366,
    metadataValuesPerFacet: 500,
    rateLimits: RATE_LIMITS,
  },
};
type Operation = {
  scopes: string[];
  body?: z.ZodType;
  query?: z.ZodType;
  conditional?: string;
  precondition?: boolean;
  public?: boolean;
};
const operationRegistry = new WeakMap<
  Hono<AppEnv>,
  Map<string, { path: string; method: string; operation: Operation }>
>();
function patchSchema(schema: z.ZodObject) {
  return z.strictObject(
    Object.fromEntries(
      Object.entries(schema.shape).map(([key, field]) => [
        key,
        (field instanceof z.ZodDefault ? field.removeDefault() : field).optional(),
      ]),
    ),
  );
}
function operationFor(method: string, path: string): Operation {
  const parts = path.split("/").filter(Boolean),
    resource = parts[0] as ApiResource;
  const sources = ["products:read", "units:read", "contribution-logs:read"];
  const specials: Record<string, Operation> = {
    "/openapi.json": { scopes: [], public: true },
    "/instructions": { scopes: [], public: true },
    "/me": { scopes: [] },
    "/capabilities": { scopes: [] },
    "/summaries/cash-flow": {
      scopes: ["transactions:read", "transfers:read"],
      query: listQuerySchema,
    },
    "/summaries/portfolio": {
      scopes: sources,
      query: z.strictObject({
        currency: z.enum(["CNY", "USD", "HKD"]).optional(),
        status: z.string().optional(),
      }),
    },
    "/products/:id/portfolio": {
      scopes: sources,
      query: z.strictObject({
        currency: z.enum(["CNY", "USD", "HKD"]).optional(),
        status: z.string().optional(),
      }),
    },
    "/accounts/balances": {
      scopes: [
        "transactions:read",
        "transfers:read",
        "account-classifications:read",
        "balance-anchors:read",
      ],
      query: z.strictObject({
        asOf: z.iso.date(),
        currency: z.enum(["CNY", "USD", "HKD"]).optional(),
        account: z.string().max(200).optional(),
      }),
    },
    "/recurring-expenses/occurrences": {
      scopes: ["recurring-expenses:read"],
      query: z.strictObject({
        startDate: z.iso.date(),
        endDate: z.iso.date(),
        id: z.string().optional(),
        includeCategories: z.enum(["true", "false"]).default("false"),
      }),
      conditional: "includeCategories=true also requires expense-categories:read",
    },
    "/metadata": {
      scopes: [],
      query: z.strictObject({ sources: z.string().min(1) }),
      conditional:
        "Every selected transactions/transfers source requires its read scope; maximum 500 distinct values per independent facet; categoryPaths are [primary,secondary,tertiary] arrays; no truncation.",
    },
    "/audit-events": {
      scopes: ["audit:read"],
      query: z.strictObject({
        limit: z.coerce.number().int().min(1).max(500).default(100),
        cursor: z.string().max(8000).optional(),
      }),
    },
    "/units/:id/preflight": { scopes: sources },
    "/units/:id/commit": {
      scopes: ["units:commit"],
      body: commitUnitSchema.strict(),
      precondition: true,
    },
    "/contribution-logs/:id/restore": { scopes: ["contribution-logs:write"], precondition: true },
    "/recurring-expenses/:id/state": {
      scopes: ["recurring-expenses:write"],
      body: z.strictObject({ transition: z.enum(["pause", "resume", "end"]) }),
      precondition: true,
    },
    "/ledger-replacements/preview": {
      scopes: ["data:replace"],
      body: replacementSchema,
      conditional:
        "Each selected ledger requires its read, write and delete scopes; preview writes nothing.",
    },
    "/ledger-replacements": {
      scopes: ["data:replace"],
      body: replacementSchema,
      conditional:
        "Each selected ledger requires its read, write and delete scopes; digest and expectedDataRevision must match preview.",
    },
  };
  if (specials[path]) return specials[path];
  if (parts[1] === "aggregate") return { scopes: [`${resource}:read`], query: listQuerySchema };
  if (parts[1] === "batch")
    return {
      scopes: [`${resource}:write`],
      body: z.strictObject({ items: z.array(resources[resource].schema).min(1).max(100) }),
    };
  const schema = resources[resource]?.schema;
  if (!schema) throw new Error(`Undocumented API route ${method} ${path}`);
  const action = method === "GET" ? "read" : method === "DELETE" ? "delete" : "write";
  const op: Operation = { scopes: [`${resource}:${action}`] };
  if (method === "GET" && parts.length === 1 && resource !== "financial-preferences")
    op.query = listQuerySchema;
  if (method === "PATCH" || method === "PUT" || method === "POST")
    op.body = method === "PATCH" ? patchSchema(schema) : schema;
  if (method === "PATCH" || method === "PUT" || method === "DELETE") op.precondition = true;
  if (resource === "analyses" && action === "write")
    op.conditional =
      "Every evidence family requires its read scope, and all referenced IDs must belong to the same owner. externalId is immutable after creation, including null.";
  if (resource === "units" && method === "PATCH")
    op.conditional =
      "amountCents, productId, status and currency are always rejected; use the versioned unit commit operation.";
  if (resource === "units" && method === "DELETE")
    op.conditional = "Deleting a unit with logs also requires contribution-logs:delete.";
  if (resource === "expense-categories" && method === "DELETE")
    op.conditional = "Detaching referenced rules also requires recurring-expenses:write.";
  return op;
}
function enforceMethod(app: Hono<AppEnv>, c: C) {
  const matches = [...(operationRegistry.get(app)?.values() ?? [])].filter((entry) =>
    new RegExp(`^/api/v1${entry.path.replace(/:[^/]+/g, "[^/]+")}$`).test(c.req.path),
  );
  if (!matches.length) return;
  const specificity = (path: string) =>
    path.split("/").filter((part) => part && !part.startsWith(":")).length;
  const best = Math.max(...matches.map((entry) => specificity(entry.path)));
  const allowed = matches
    .filter((entry) => specificity(entry.path) === best)
    .map((entry) => entry.method.toUpperCase());
  if (!allowed.includes(c.req.method)) {
    c.header("Allow", allowed.join(", "));
    throw new ApiError(405, "method_not_allowed");
  }
}
function documented(app: Hono<AppEnv>) {
  const register = (
    method: "get" | "post" | "put" | "patch" | "delete",
    path: string,
    handler: Handler<AppEnv>,
  ) => {
    const operation = operationFor(method.toUpperCase(), path);
    let registry = operationRegistry.get(app);
    if (!registry) {
      registry = new Map();
      operationRegistry.set(app, registry);
    }
    registry.set(`${method} ${path}`, { path, method, operation });
    app[method](path, (c, next) => {
      requireScopes(c, operation.scopes);
      return handler(c, next);
    });
  };
  return {
    get: (path: string, h: Handler<AppEnv>) => register("get", path, h),
    post: (path: string, h: Handler<AppEnv>) => register("post", path, h),
    put: (path: string, h: Handler<AppEnv>) => register("put", path, h),
    patch: (path: string, h: Handler<AppEnv>) => register("patch", path, h),
    delete: (path: string, h: Handler<AppEnv>) => register("delete", path, h),
  };
}
function openapi(app: Hono<AppEnv>) {
  const paths: Row = {};
  const jsonSchema = (schema: z.ZodType) =>
    z.toJSONSchema(schema, { unrepresentable: "any", io: "input" });
  for (const { path, method, operation: op } of operationRegistry.get(app)?.values() ?? []) {
    const parameters: Row[] = path
      .split("/")
      .filter((part) => part.startsWith(":"))
      .map((part) => ({
        name: part.slice(1),
        in: "path",
        required: true,
        schema: { type: "string", minLength: 1 },
      }));
    if (op.query) {
      const schema = jsonSchema(op.query);
      for (const [name, value] of Object.entries(schema.properties ?? {}))
        parameters.push({
          name,
          in: "query",
          required: schema.required?.includes(name) ?? false,
          schema: value,
        });
    }
    const write = method !== "get" && path !== "/ledger-replacements/preview";
    if (write)
      parameters.push({
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: { type: "string", pattern: "^[A-Za-z0-9._:-]{1,128}$" },
        description: "Identical requests replay for seven days; changed input conflicts.",
      });
    if (op.precondition)
      parameters.push({
        name: "If-Match",
        in: "header",
        required: true,
        schema: { type: "string", pattern: '^"(0|[1-9][0-9]*)"$' },
        description: "Current quoted integer resource version.",
      });
    const success =
      method === "post" &&
      !path.includes("/commit") &&
      !path.endsWith("/state") &&
      !path.endsWith("/restore") &&
      !path.includes("ledger-replacements")
        ? "201"
        : "200";
    const envelopeSchema = {
      type: "object",
      required: ["data", "meta"],
      properties: {
        data: {},
        meta: {
          type: "object",
          properties: {
            requestId: { type: "string" },
            dataRevision: { type: "integer", minimum: 0 },
          },
        },
      },
    };
    const responses: Row = {
      [success]: {
        description: write
          ? "Minimal mutation receipt; no read grant implied"
          : "Authorized revision-checked result",
        content: { "application/json": { schema: envelopeSchema } },
      },
    };
    for (const code of [400, 401, 403, 404, 409, 412, 413, 415, 428, 429, 500])
      responses[String(code)] = {
        description:
          code === 429
            ? "Durable per-key or owner fixed-window budget exceeded; retry after 60 seconds"
            : "Request rejected; see stable problem code",
        ...(code === 429
          ? { headers: { "Retry-After": { schema: { type: "integer", const: 60 } } } }
          : {}),
        content: {
          "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } },
        },
      };
    const operation = {
      operationId: `${method}-${path.replaceAll(/[^A-Za-z0-9]+/g, "-")}`,
      "x-required-scopes": op.scopes,
      ...(op.conditional ? { description: op.conditional } : {}),
      ...(op.public ? { security: [] } : {}),
      parameters,
      ...(op.body
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: jsonSchema(op.body) } },
            },
          }
        : {}),
      responses,
    };
    const key = `/api/v1${path.replace(/:([^/]+)/g, "{$1}")}`;
    paths[key] = { ...((paths[key] as Row) ?? {}), [method]: operation };
  }
  return {
    openapi: "3.1.0",
    info: { title: "Noheir API", version: "1" },
    servers: [{ url: "/" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      schemas: {
        Problem: {
          type: "object",
          required: ["type", "title", "status", "code", "requestId"],
          properties: {
            type: { type: "string" },
            title: { type: "string" },
            status: { type: "integer" },
            code: { type: "string" },
            requestId: { type: "string" },
            errors: {},
          },
        },
      },
    },
    paths,
  };
}
function registerQueries(app: Hono<AppEnv>) {
  const api = documented(app);
  api.get("/summaries/cash-flow", async (c) => {
    requireScopes(c, ["transactions:read", "transfers:read"]);
    const tx = filters(c, "transactions"),
      tr = filters(c, "transfers");
    const read = await checkedRead(db(c), principal(c).owner, [
      {
        sql: `SELECT currency,type,count(*) count,sum(amount_cents) amount_cents FROM transactions r WHERE ${tx.where} GROUP BY currency,type`,
        params: tx.params,
      },
      {
        sql: `SELECT currency,count(*) count,sum(inflow_amount_cents) inflow_amount_cents,sum(outflow_amount_cents) outflow_amount_cents FROM transfers r WHERE ${tr.where} GROUP BY currency`,
        params: tr.params,
      },
    ]);
    assertSafe(read.results.flat());
    return result(
      c,
      {
        transactions: (read.results[0] ?? []).map(wire),
        transfers: (read.results[1] ?? []).map(wire),
      },
      { dataRevision: read.revision, asOf: nowIso() },
    );
  });
  const portfolio = async (c: C) => {
    requireScopes(c, ["products:read", "units:read", "contribution-logs:read"]);
    const p = principal(c),
      productId = c.req.param("id");
    if (productId) await owned(db(c), "products", p.owner, productId);
    const q = z
      .strictObject({
        currency: z.enum(["CNY", "USD", "HKD"]).optional(),
        status: z.string().optional(),
      })
      .safeParse(c.req.query());
    if (!q.success) throw new ApiError(400, "invalid_query");
    const where =
      "u.user_id=?" +
      (productId ? " AND u.product_id=?" : "") +
      (q.data.currency ? " AND u.currency=?" : "") +
      (q.data.status ? " AND u.status=?" : "");
    const read = await checkedRead(db(c), p.owner, [
      {
        sql: `SELECT u.*,p.name product_name,p.lock_period_days,p.open_days,p.cycle_days,
      (SELECT operation_date FROM contribution_logs l WHERE l.user_id=u.user_id AND l.unit_id=u.id AND l.operation_type='invest' AND l.deleted_at IS NULL ORDER BY l.operation_date DESC,l.created_at DESC,l.id DESC LIMIT 1) latest_invest_date,
      (SELECT coalesce(sum(pnl_cents),0) FROM contribution_logs l WHERE l.user_id=u.user_id AND l.unit_id=u.id AND l.deleted_at IS NULL) realized_pnl_cents
      FROM capital_units u LEFT JOIN financial_products p ON p.id=u.product_id AND p.user_id=u.user_id WHERE ${where} ORDER BY u.id DESC LIMIT 501`,
        params: [
          p.owner,
          ...(productId ? [productId] : []),
          ...(q.data.currency ? [q.data.currency] : []),
          ...(q.data.status ? [q.data.status] : []),
        ],
      },
    ]);
    const rows = read.results[0] ?? [];
    if (rows.length > 500) throw new ApiError(400, "portfolio_too_many_units");
    assertSafe(rows);
    const holdings = rows.map((row) => ({
      ...wire(row),
      ...computeAvailability(
        row.latest_invest_date ? { operationDate: String(row.latest_invest_date) } : null,
        row.product_id
          ? {
              lockPeriodDays: row.lock_period_days as number | null,
              openDays: row.open_days as number | null,
              cycleDays: row.cycle_days as number | null,
            }
          : null,
        undefined,
        row.available_date_override as string | null,
      ),
    }));
    return result(c, holdings, {
      returned: holdings.length,
      dataRevision: read.revision,
      asOf: nowIso(),
    });
  };
  api.get("/summaries/portfolio", portfolio);
  api.get("/products/:id/portfolio", portfolio);
  api.get("/accounts/balances", async (c) => {
    requireScopes(c, [
      "transactions:read",
      "transfers:read",
      "account-classifications:read",
      "balance-anchors:read",
    ]);
    const parsed = z
      .strictObject({
        asOf: z.iso.date(),
        currency: z.enum(["CNY", "USD", "HKD"]).optional(),
        account: z.string().max(200).optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ApiError(400, "invalid_query");
    const q = parsed.data,
      p = principal(c);
    const sql = `WITH accounts AS (
      SELECT account,currency FROM transactions WHERE user_id=? UNION SELECT account,currency FROM transfers WHERE user_id=? UNION SELECT account_name,currency FROM balance_anchors WHERE user_id=?
    ), anchored AS (SELECT a.account,a.currency,c.type,
      (SELECT id FROM balance_anchors b WHERE b.user_id=? AND b.account_name=a.account AND b.currency=a.currency AND b.date<=? ORDER BY b.date DESC,b.id DESC LIMIT 1) anchor_id
      FROM accounts a LEFT JOIN account_classifications c ON c.user_id=? AND c.account_name=a.account)
      SELECT a.account,a.currency,a.type,b.id anchor_id,b.date anchor_date,b.balance_cents,
      CASE WHEN b.id IS NULL THEN NULL ELSE b.balance_cents+
      coalesce((SELECT sum(CASE WHEN t.type='income' THEN t.amount_cents ELSE -t.amount_cents END) FROM transactions t WHERE t.user_id=? AND t.account=a.account AND t.currency=a.currency AND t.date>b.date AND t.date<=?),0)+
      coalesce((SELECT sum(t.inflow_amount_cents-t.outflow_amount_cents) FROM transfers t WHERE t.user_id=? AND t.account=a.account AND t.currency=a.currency AND t.date>b.date AND t.date<=?),0) END reconstructed_balance_cents
      FROM anchored a LEFT JOIN balance_anchors b ON b.id=a.anchor_id AND b.user_id=? WHERE 1=1 ${q.currency ? "AND a.currency=?" : ""} ${q.account ? "AND a.account=?" : ""} ORDER BY a.account,a.currency LIMIT 501`;
    const read = await checkedRead(db(c), p.owner, [
      {
        sql,
        params: [
          p.owner,
          p.owner,
          p.owner,
          p.owner,
          q.asOf,
          p.owner,
          p.owner,
          q.asOf,
          p.owner,
          q.asOf,
          p.owner,
          ...(q.currency ? [q.currency] : []),
          ...(q.account ? [q.account] : []),
        ],
      },
    ]);
    const rows = read.results[0] ?? [];
    if (rows.length > 500) throw new ApiError(400, "balances_too_many_accounts");
    assertSafe(rows);
    return result(
      c,
      rows.map((row) => ({
        ...wire(row),
        status: row.anchor_id ? "known" : "unknown",
        assumptions: [
          "anchor includes all activity on its date",
          "no FX conversion",
          "transfer rows are account-local flows",
        ],
        asOf: q.asOf,
      })),
      { dataRevision: read.revision, asOf: nowIso() },
    );
  });
  api.get("/recurring-expenses/occurrences", async (c) => {
    requireScopes(c, ["recurring-expenses:read"]);
    const parsed = z
      .strictObject({
        startDate: z.iso.date(),
        endDate: z.iso.date(),
        id: z.string().optional(),
        includeCategories: z.enum(["true", "false"]).default("false"),
      })
      .safeParse(c.req.query());
    if (!parsed.success) throw new ApiError(400, "invalid_query");
    const q = parsed.data;
    if (
      q.endDate < q.startDate ||
      (Date.parse(q.endDate) - Date.parse(q.startDate)) / 86400000 > 365
    )
      throw new ApiError(400, "occurrence_window_too_large");
    if (q.includeCategories === "true") requireScopes(c, ["expense-categories:read"]);
    const p = principal(c),
      read = await checkedRead(db(c), p.owner, [
        {
          sql: `SELECT r.* ${q.includeCategories === "true" ? ",c.name category_name,c.color_token" : ""} FROM recurring_expenses r ${q.includeCategories === "true" ? "LEFT JOIN expense_categories c ON c.id=r.category_id AND c.user_id=r.user_id" : ""} WHERE r.user_id=? ${q.id ? "AND r.id=?" : ""} ORDER BY r.id LIMIT 501`,
          params: [p.owner, ...(q.id ? [q.id] : [])],
        },
      ]);
    const rules = read.results[0] ?? [];
    if (rules.length > 500) throw new ApiError(400, "occurrences_too_many_rules");
    const occurrences = rules.flatMap((row) =>
      computeOccurrences(
        { ...wire(row), userId: p.owner } as unknown as RecurrenceRule,
        q.startDate,
        q.endDate,
      ).map((date) => ({
        ruleId: row.id,
        date,
        amountCents: row.amount_cents,
        currency: row.currency,
        ...(q.includeCategories === "true"
          ? { categoryName: row.category_name, colorToken: row.color_token }
          : {}),
      })),
    );
    if (occurrences.length > 5000) throw new ApiError(400, "occurrences_too_many_results");
    return result(c, occurrences, {
      returned: occurrences.length,
      dataRevision: read.revision,
      asOf: nowIso(),
    });
  });
  api.get("/metadata", async (c) => {
    const parsed = z.strictObject({ sources: z.string().min(1) }).safeParse(c.req.query());
    if (!parsed.success) throw new ApiError(400, "invalid_query");
    const sources = parsed.data.sources.split(",");
    if (
      new Set(sources).size !== sources.length ||
      sources.some((s) => s !== "transactions" && s !== "transfers")
    )
      throw new ApiError(400, "invalid_metadata_sources");
    requireScopes(
      c,
      sources.map((s) => `${s}:read`),
    );
    const facets = ["years", "currencies", "accounts", "categoryPaths", "tags"] as const;
    const expressions = {
      years: "year",
      currencies: "currency",
      accounts: "account",
      categoryPaths: "json_array(primary_category,secondary_category,tertiary_category)",
      tags: "j.value",
    };
    const read = await checkedRead(
      db(c),
      principal(c).owner,
      facets.map((facet) => ({
        sql: `${sources
          .map(
            (source) =>
              `SELECT DISTINCT ${facet === "categoryPaths" && source === "transfers" ? "json_array(primary_category,secondary_category,null)" : expressions[facet]} value FROM ${source} ${facet === "tags" ? "JOIN json_each(tags) j" : ""} WHERE user_id=?`,
          )
          .join(" UNION ")} ORDER BY value LIMIT 501`,
        params: sources.map(() => principal(c).owner),
      })),
    );
    if (read.results.some((rows) => rows.length > 500))
      throw new ApiError(400, "metadata_too_many_values");
    return result(
      c,
      Object.fromEntries(
        facets.map((facet, i) => [
          facet,
          (read.results[i] ?? [])
            .filter((row) => row.value !== null)
            .map((row) => (facet === "categoryPaths" ? JSON.parse(String(row.value)) : row.value)),
        ]),
      ),
      { dataRevision: read.revision, asOf: nowIso(), sources, limitPerFacet: 500 },
    );
  });
  api.get("/audit-events", async (c) => {
    requireScopes(c, ["audit:read"]);
    const q = z
      .strictObject({
        limit: z.coerce.number().int().min(1).max(500).default(100),
        cursor: z.string().max(8000).optional(),
      })
      .safeParse(c.req.query());
    if (!q.success) throw new ApiError(400, "invalid_query");
    const p = principal(c),
      binding = canonical({ owner: p.owner, key: p.keyId, limit: q.data.limit, order: "id:desc" });
    let cursor: { binding: string; id: string; revision: number } | undefined;
    if (q.data.cursor) {
      try {
        cursor = z
          .strictObject({
            binding: z.string(),
            id: z.string(),
            revision: z.number().int().nonnegative(),
          })
          .parse(JSON.parse(decodeCursor(q.data.cursor)));
      } catch {
        throw new ApiError(400, "invalid_cursor");
      }
      if (cursor.binding !== binding) throw new ApiError(400, "cursor_query_mismatch");
    }
    const read = await checkedRead(db(c), p.owner, [
      { sql: "SELECT count(*) audit_revision FROM api_audit WHERE owner_id=?", params: [p.owner] },
      {
        sql: `SELECT id,actor_kind,key_id,request_id,operation,resource,resource_id,from_version,to_version,affected,created_at FROM api_audit WHERE owner_id=? ${cursor ? "AND id<?" : ""} ORDER BY id DESC LIMIT ?`,
        params: [p.owner, ...(cursor ? [cursor.id] : []), q.data.limit + 1],
      },
    ]);
    const revision = Number(read.results[0]?.[0]?.audit_revision);
    if (cursor && cursor.revision !== revision) throw new ApiError(409, "dataset_changed");
    const rows = read.results[1] ?? [],
      data = rows.slice(0, q.data.limit),
      hasMore = rows.length > data.length;
    return result(c, data.map(wire), {
      returned: data.length,
      hasMore,
      nextCursor: hasMore
        ? encodeCursor(JSON.stringify({ binding, id: data.at(-1)?.id, revision }))
        : null,
      auditRevision: revision,
      dataRevision: read.revision,
      asOf: nowIso(),
    });
  });
}
function assertSafe(rows: Row[]) {
  for (const row of rows)
    for (const value of Object.values(row))
      if (
        typeof value === "number" &&
        (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
      )
        throw new ApiError(409, "aggregate_overflow");
}
const replacementSchema = z.strictObject({
  year: z.number().int().min(1900).max(2100).nullable(),
  transactions: z.array(z.unknown()).max(500).optional(),
  transfers: z.array(z.unknown()).max(500).optional(),
  allowEmpty: z.boolean().default(false),
  expectedDataRevision: z.number().int().nonnegative(),
  digest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
function registerOperations(app: Hono<AppEnv>) {
  const api = documented(app);
  for (const resource of ["transactions", "transfers"] as const)
    api.post(`/${resource}/batch`, async (c) => {
      requireScopes(c, [`${resource}:write`]);
      const body = z
        .strictObject({ items: z.array(z.unknown()).min(1).max(100) })
        .safeParse(await json(c));
      if (!body.success) throw new ApiError(400, "invalid_batch");
      const items = body.data.items.map((item) => validated(resource, item));
      return mutate(c, resource, items, async () => {
        const p = principal(c),
          now = Date.now();
        const ids = items.map(() => crypto.randomUUID());
        return {
          statements: items.map((item, i) =>
            rowStatement(
              resources[resource].table,
              ids[i] as string,
              p.owner,
              prepareFinancialData(resource, item, now, true, p),
              "$GUARD",
              guardArgs,
            ),
          ),
          data: { ids, affected: items.length, version: 1 },
          status: 201,
        };
      });
    });
  api.post("/contribution-logs/:id/restore", (c) => restoreLog(c));
  api.post("/recurring-expenses/:id/state", (c) => changeRecurringState(c));
  api.get("/units/:id/preflight", async (c) => {
    requireScopes(c, ["units:read", "products:read", "contribution-logs:read"]);
    const p = principal(c),
      id = c.req.param("id");
    const read = await checkedRead(db(c), p.owner, [
      { sql: "SELECT * FROM capital_units WHERE user_id=? AND id=?", params: [p.owner, id] },
      {
        sql: "SELECT * FROM contribution_logs WHERE user_id=? AND unit_id=? AND deleted_at IS NULL ORDER BY operation_date DESC,created_at DESC,id DESC LIMIT 501",
        params: [p.owner, id],
      },
    ]);
    const row = read.results[0]?.[0];
    if (!row) throw new ApiError(404, "not_found");
    if ((read.results[1]?.length ?? 0) > 500) throw new ApiError(400, "preflight_too_many_logs");
    c.header("ETag", `"${row.version}"`);
    return result(
      c,
      {
        unit: wire(row),
        expected: expectedUnitSchema.parse(wire(row)),
        logs: read.results[1]?.map(wire),
      },
      { dataRevision: read.revision },
    );
  });
  api.post("/units/:id/commit", (c) => commit(c));

  const replacement = async (c: C, preview: boolean) => {
    requireScopes(c, ["data:replace"]);
    const parsed = replacementSchema.safeParse(await json(c));
    if (!parsed.success) throw new ApiError(400, "invalid_replacement");
    const body = parsed.data,
      selected = (["transactions", "transfers"] as const).filter((r) => body[r] !== undefined);
    if (!selected.length) throw new ApiError(400, "empty_selection");
    requireScopes(
      c,
      selected.flatMap((r) => [`${r}:read`, `${r}:write`, `${r}:delete`]),
    );
    const payload: Row = {
      year: body.year,
      allowEmpty: body.allowEmpty,
      expectedDataRevision: body.expectedDataRevision,
    };
    for (const resource of selected) {
      const items = (body[resource] ?? []).map((item) => validated(resource, item));
      if (!items.length && !body.allowEmpty)
        throw new ApiError(400, "empty_replacement_requires_confirmation");
      if (
        body.year !== null &&
        items.some((item) => String(item.date).slice(0, 4) !== String(body.year))
      )
        throw new ApiError(400, "year_mismatch");
      payload[resource] = items;
    }
    const digest = await sha256(canonical(payload)),
      p = principal(c);
    if (preview) {
      const read = await checkedRead(
        db(c),
        p.owner,
        selected.map((resource) => ({
          sql: `SELECT count(*) affected FROM ${resources[resource].table} WHERE user_id=? ${body.year === null ? "" : "AND year=?"}`,
          params: [p.owner, ...(body.year === null ? [] : [body.year])],
        })),
      );
      if (read.revision !== body.expectedDataRevision) throw new ApiError(409, "dataset_changed");
      return result(
        c,
        {
          digest,
          expectedDataRevision: read.revision,
          year: body.year,
          affected: Object.fromEntries(
            selected.map((r, i) => [r, read.results[i]?.[0]?.affected ?? 0]),
          ),
          inserted: Object.fromEntries(selected.map((r) => [r, (payload[r] as unknown[]).length])),
          deletion: selected.some((r) => (payload[r] as unknown[]).length === 0),
        },
        { dataRevision: read.revision },
      );
    }
    if (body.digest !== digest) throw new ApiError(400, "replacement_digest_mismatch");
    return mutate(c, "ledger-replacements", payload, async () => {
      const statements: Sql[] = [],
        now = Date.now();
      for (const resource of selected) {
        statements.push({
          sql: `DELETE FROM ${resources[resource].table} WHERE user_id=? ${body.year === null ? "" : "AND year=?"} AND $GUARD`,
          params: [p.owner, ...(body.year === null ? [] : [body.year]), ...guardArgs],
        });
        for (const item of payload[resource] as Row[])
          statements.push(
            rowStatement(
              resources[resource].table,
              crypto.randomUUID(),
              p.owner,
              prepareFinancialData(resource, item, now, true, p),
              "$GUARD",
              guardArgs,
            ),
          );
      }
      return {
        statements,
        precondition: {
          sql: "coalesce((SELECT revision FROM owner_revisions WHERE owner_id=?),0)=?",
          params: [p.owner, body.expectedDataRevision],
        },
        data: {
          id: digest,
          version: body.expectedDataRevision,
          affected: selected.reduce((n, r) => n + (payload[r] as unknown[]).length, 0),
        },
        status: 200,
      };
    });
  };
  api.post("/ledger-replacements/preview", (c) => replacement(c, true));
  api.post("/ledger-replacements", (c) => replacement(c, false));
}

export async function commit(c: C, provided?: unknown): Promise<Response> {
  requireScopes(c, ["units:commit"]);
  const input = commitUnitSchema.strict().safeParse(provided ?? (await json(c)));
  if (!input.success) throw new ApiError(400, "invalid_commit");
  const version = ifMatch(c);
  return mutate(c, "units", input.data, async (token) => {
    const p = principal(c),
      id = c.req.param("id") as string,
      row = await owned(db(c), "units", p.owner, id),
      body = input.data;
    const original = expectedUnitSchema.parse(wire(row));
    if (canonical(original) !== canonical(body.expected))
      throw new ApiError(409, "unit_snapshot_changed");
    if (
      !body.commitNote?.trim() &&
      !body.metadata &&
      body.operations.every(
        (operation) =>
          operation.kind === "set_available_date" &&
          operation.availableDate === original.availableDateOverride,
      )
    )
      throw new ApiError(400, "empty_commit");
    const from = row.product_id
      ? await owned(db(c), "products", p.owner, String(row.product_id))
      : null;
    let swapTarget: SwapTarget | undefined;
    let toProduct: { id: string; name: string | null } | null = null;
    for (const operation of body.operations) {
      if (operation.kind === "swap_unit_code") {
        if (operation.targetUnitId === id) throw new ApiError(400, "invalid_swap");
        const target = await owned(db(c), "units", p.owner, operation.targetUnitId);
        const product = target.product_id
          ? await owned(db(c), "products", p.owner, String(target.product_id))
          : null;
        swapTarget = {
          id: operation.targetUnitId,
          unitCode: String(target.unit_code),
          productId: target.product_id as string | null,
          productName: (product?.name ?? null) as string | null,
        };
      }
      if (operation.kind === "switch_product") {
        if (operation.toProductId === row.product_id) throw new ApiError(400, "unchanged_product");
        if (operation.pnlCents != null && !row.product_id)
          throw new ApiError(400, "pnl_requires_product");
        if (operation.toProductId) {
          const product = await owned(db(c), "products", p.owner, operation.toProductId);
          if (product.currency !== (body.metadata?.currency ?? row.currency))
            throw new ApiError(409, "currency_mismatch");
          toProduct = { id: String(product.id), name: product.name as string | null };
        }
      }
    }
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
    const statements = buildCommitStatements({
      userId: p.owner,
      unitId: id,
      expected: body.expected,
      metadata: body.metadata,
      operations: body.operations,
      operationDate: body.operationDate ?? today,
      today,
      commitNote: body.commitNote,
      swapTarget,
      fromProduct: from ? { id: String(from.id), name: from.name as string | null } : null,
      toProduct,
      now: Math.floor(Date.now() / 1000),
      commitToken: token,
      newId: () => crypto.randomUUID(),
    });
    const first = statements[0];
    if (!first) throw new ApiError(400, "empty_commit");
    const whereIndex = first.sql.indexOf(" WHERE ");
    const setParameters = (first.sql.slice(0, whereIndex).match(/\?/g) ?? []).length;
    const precondition = versionPrecondition("units", p.owner, id, version);
    precondition.sql += ` AND EXISTS(SELECT 1 FROM capital_units WHERE ${first.sql.slice(whereIndex + 7)})`;
    precondition.params.push(...first.params.slice(setParameters));
    first.sql += " AND $GUARD";
    first.params.push(...guardArgs);
    return {
      statements,
      precondition,
      data: { id, version: version + 1, affected: 1 },
      status: 200,
    };
  });
}

export async function restoreLog(c: C): Promise<Response> {
  requireScopes(c, ["contribution-logs:write"]);
  const version = ifMatch(c);
  return mutate(c, "contribution-logs", null, async () => {
    const p = principal(c),
      id = c.req.param("id") as string,
      row = await owned(db(c), "contribution-logs", p.owner, id);
    if (row.deleted_at == null) throw new ApiError(409, "log_not_deleted");
    return {
      statements: [
        {
          sql: "UPDATE contribution_logs SET deleted_at=NULL,updated_at=? WHERE user_id=? AND id=? AND $GUARD",
          params: [Math.floor(Date.now() / 1000), p.owner, id, ...guardArgs],
        },
      ],
      precondition: versionPrecondition("contribution-logs", p.owner, id, version),
      data: { id, version: version + 1, affected: 1 },
      status: 200,
    };
  });
}

export async function changeRecurringState(c: C): Promise<Response> {
  requireScopes(c, ["recurring-expenses:write"]);
  const input = z
    .strictObject({ transition: z.enum(["pause", "resume", "end"]) })
    .safeParse(await json(c));
  if (!input.success) throw new ApiError(400, "invalid_transition");
  const version = ifMatch(c);
  return mutate(c, "recurring-expenses", input.data, async () => {
    const p = principal(c),
      id = c.req.param("id") as string,
      row = await owned(db(c), "recurring-expenses", p.owner, id);
    if (!isRecurringStatus(String(row.status))) throw new ApiError(409, "invalid_status");
    const patch = patchForTransition(
      input.data.transition,
      row.status as "active" | "paused" | "ended",
    );
    if (!patch.ok) throw new ApiError(409, "invalid_transition");
    return {
      statements: [
        rowStatement(
          "recurring_expenses",
          id,
          p.owner,
          {
            status: patch.status,
            endedAt: patch.endedAt,
            updatedAt: Math.floor(Date.now() / 1000),
          },
          "$GUARD",
          guardArgs,
          true,
        ),
      ],
      precondition: versionPrecondition("recurring-expenses", p.owner, id, version),
      data: { id, version: version + 1, affected: 1 },
      status: 200,
    };
  });
}
export async function browserSave(c: C, resource: ApiResource, update = false): Promise<Response> {
  let input = (await json(c)) as Row;
  if (resource === "transactions" || resource === "transfers") {
    const schema =
      resource === "transactions"
        ? update
          ? updateTransactionSchema
          : createTransactionSchema
        : update
          ? updateTransferSchema
          : createTransferSchema;
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new ApiError(400, "invalid_input");
    const fields = resources[resource].schema.shape;
    input = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key in fields));
    if (typeof input.tags === "string") {
      try {
        input.tags = JSON.parse(input.tags);
      } catch {
        throw new ApiError(400, "invalid_tags");
      }
    }
  }
  if (resource === "contribution-logs") {
    const { source: _source, productName: _productName, ...rest } = input;
    void _source;
    void _productName;
    input = rest;
  }
  let response: Response;
  if (resource === "units" && update) {
    const parsed = updateUnitSchema.safeParse(input);
    if (!parsed.success) throw new ApiError(400, "invalid_input");
    const row = await owned(db(c), "units", principal(c).owner, c.req.param("id") as string);
    const expected = expectedUnitSchema.parse(wire(row)),
      data = parsed.data;
    const { productId, note, ...metadata } = data;
    response = await commit(c, {
      expected,
      operations:
        productId !== undefined ? [{ kind: "switch_product", toProductId: productId }] : [],
      ...(Object.keys(metadata).length || note !== undefined
        ? { metadata: { ...metadata, ...(note !== undefined ? { unitNote: note } : {}) } }
        : {}),
    });
  } else response = await save(c, resource, update, input);
  if (!response.ok) return response;
  const envelope = (await response.json()) as { data: { id: string } };
  const row = await owned(db(c), resource, principal(c).owner, envelope.data.id);
  return c.json(
    { [browserNames[resource] ?? resource]: { ...wire(row), userId: principal(c).owner } },
    update ? 200 : 201,
  );
}
const browserNames: Partial<Record<ApiResource, string>> = {
  transactions: "transaction",
  transfers: "transfer",
  products: "product",
  units: "unit",
  "contribution-logs": "log",
  "expense-categories": "category",
  "recurring-expenses": "rule",
};
export async function browserRemove(c: C, resource: ApiResource): Promise<Response> {
  const response = await remove(c, resource);
  if (!response.ok) return response;
  return resource === "expense-categories" || resource === "recurring-expenses"
    ? c.body(null, 204)
    : c.json({ success: true });
}
export async function browserCommit(c: C): Promise<Response> {
  const response = await commit(c);
  if (!response.ok) return response;
  const row = await owned(db(c), "units", principal(c).owner, c.req.param("id") as string);
  return c.json({ unit: { ...wire(row), userId: principal(c).owner } });
}
export async function browserState(c: C): Promise<Response> {
  const response = await changeRecurringState(c);
  return response.ok ? c.json({ success: true }) : response;
}
export async function browserRestore(c: C): Promise<Response> {
  const response = await restoreLog(c);
  if (!response.ok) return response;
  return c.json({
    log: {
      ...wire(
        await owned(db(c), "contribution-logs", principal(c).owner, c.req.param("id") as string),
      ),
      userId: principal(c).owner,
    },
  });
}
