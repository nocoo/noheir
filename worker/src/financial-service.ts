import { z } from "zod";
import {
  type ApiResource,
  accountClassificationSchema,
  analysisSchema,
  apiCentsSchema,
  apiCurrencySchema,
  apiDateSchema,
  balanceAnchorSchema,
  financialPreferencesSchema,
} from "../../src/domain/api-contract";
import {
  createContributionLogSchema,
  createExpenseCategorySchema,
  createProductSchema,
  createRecurringExpenseSchema,
  createUnitSchema,
  dateParts,
} from "../db/validation";

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 405 | 409 | 412 | 413 | 415 | 428 | 429 | 500,
    public code: string,
    public fields?: unknown,
  ) {
    super(code);
  }
}
const text = z.string().min(1).max(200);
const tags = z.array(text).max(100).default([]);
const ledgerShape = {
  date: apiDateSchema,
  account: text,
  currency: apiCurrencySchema,
  tags,
  primaryCategory: text.nullable().optional(),
  secondaryCategory: text.nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
};
export const transactionSchema = z.strictObject({
  ...ledgerShape,
  primaryCategory: text,
  tertiaryCategory: text,
  type: z.enum(["income", "expense"]),
  amountCents: apiCentsSchema,
});
export const transferSchema = z.strictObject({
  ...ledgerShape,
  transactionType: text.nullable().optional(),
  inflowAmountCents: apiCentsSchema.default(0),
  outflowAmountCents: apiCentsSchema.default(0),
});
export const resources = {
  transactions: { table: "transactions", schema: transactionSchema },
  transfers: { table: "transfers", schema: transferSchema },
  products: { table: "financial_products", schema: createProductSchema.strict() },
  units: { table: "capital_units", schema: createUnitSchema.strict() },
  "contribution-logs": {
    table: "contribution_logs",
    schema: createContributionLogSchema.omit({ source: true, productName: true }).strict(),
  },
  "expense-categories": {
    table: "expense_categories",
    schema: createExpenseCategorySchema.strict(),
  },
  "recurring-expenses": {
    table: "recurring_expenses",
    schema: createRecurringExpenseSchema.strict(),
  },
  "account-classifications": {
    table: "account_classifications",
    schema: accountClassificationSchema,
  },
  "balance-anchors": { table: "balance_anchors", schema: balanceAnchorSchema },
  "financial-preferences": { table: "financial_preferences", schema: financialPreferencesSchema },
  analyses: { table: "analyses", schema: analysisSchema },
} satisfies Record<ApiResource, { table: string; schema: z.ZodType }>;
export type Row = Record<string, unknown>;
export type Sql = { sql: string; params: unknown[] };
export const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const camel = (key: string) =>
  key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
const jsonFields = new Set([
  "tags",
  "evidence",
  "currencies",
  "activeIncomeCategories",
  "fixedExpenseCategories",
  "createdBy",
]);
export function wire(row: Row): Row {
  const result: Row = {};
  for (const [column, value] of Object.entries(row)) {
    const key = camel(column);
    if (["userId", "ownerId", "commitToken", "rawIndex", "hasSecondaryMapping"].includes(key))
      continue;
    if (jsonFields.has(key)) result[key] = typeof value === "string" ? JSON.parse(value) : value;
    else if (["createdAt", "updatedAt", "deletedAt"].includes(key))
      result[key] =
        value == null
          ? null
          : new Date(Number(value) < 1e12 ? Number(value) * 1000 : Number(value)).toISOString();
    else if (key === "isArchived") result[key] = Boolean(value);
    else result[key] = value;
  }
  return result;
}
export function dbFields(data: Row): Row {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      snake(key),
      jsonFields.has(key)
        ? JSON.stringify(value)
        : typeof value === "boolean"
          ? Number(value)
          : value,
    ]),
  );
}
export function validated(resource: ApiResource, value: unknown, partial = false): Row {
  const schema = resources[resource].schema;
  const patchSchema = z.strictObject(
    Object.fromEntries(
      Object.entries(schema.shape).map(([key, field]) => [
        key,
        (field instanceof z.ZodDefault ? field.removeDefault() : field).optional(),
      ]),
    ),
  );
  const parsed = partial ? patchSchema.safeParse(value) : schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      400,
      "invalid_input",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  const data = parsed.data as Row;
  if (partial && !Object.keys(data).length) throw new ApiError(400, "empty_update");
  for (const [key, value] of Object.entries(data)) {
    if (
      key.endsWith("Date") &&
      typeof value === "string" &&
      !apiDateSchema.safeParse(value).success
    )
      throw new ApiError(400, "invalid_date");
    if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value))
      throw new ApiError(400, "unsafe_integer");
  }
  if (data.currency !== undefined && !apiCurrencySchema.safeParse(data.currency).success)
    throw new ApiError(400, "invalid_currency");
  return data;
}
export function rowStatement(
  table: string,
  id: string,
  owner: string,
  data: Row,
  guard: string,
  guardParams: unknown[],
  update = false,
): Sql {
  const fields = dbFields(data);
  if (update)
    return {
      sql: `UPDATE ${table} SET ${Object.keys(fields)
        .map((key) => `${key}=?`)
        .join(",")} WHERE id=? AND user_id=? AND ${guard}`,
      params: [...Object.values(fields), id, owner, ...guardParams],
    };
  const all = { id, user_id: owner, ...fields };
  return {
    sql: `INSERT INTO ${table}(${Object.keys(all).join(",")}) SELECT ${Object.keys(all)
      .map(() => "?")
      .join(",")} WHERE ${guard}`,
    params: [...Object.values(all), ...guardParams],
  };
}
export async function owned(
  db: D1Database,
  resource: ApiResource,
  owner: string,
  id: string,
): Promise<Row> {
  const row = await db
    .prepare(`SELECT * FROM ${resources[resource].table} WHERE id=? AND user_id=?`)
    .bind(id, owner)
    .first<Row>();
  if (!row) throw new ApiError(404, "not_found");
  return row;
}
export async function references(
  db: D1Database,
  resource: ApiResource,
  owner: string,
  data: Row,
  existing?: Row,
) {
  if (existing) {
    if (
      resource === "analyses" &&
      data.externalId !== undefined &&
      data.externalId !== existing.external_id
    )
      throw new ApiError(400, "immutable_external_id");
    const fields = resources[resource].schema.shape;
    const merged = Object.fromEntries(
      Object.entries({ ...wire(existing), ...data }).filter(([key]) => key in fields),
    );
    const checked = resources[resource].schema.safeParse(merged);
    if (!checked.success) throw new ApiError(400, "invalid_input");
  }
  if (resource === "analyses")
    for (const evidence of (data.evidence ?? []) as { resource: ApiResource; ids: string[] }[])
      for (const id of evidence.ids) await owned(db, evidence.resource, owner, id);
  for (const [field, target] of [
    ["productId", "products"],
    ["unitId", "units"],
    ["categoryId", "expense-categories"],
  ] as const) {
    const id = data[field];
    if (typeof id === "string") {
      const ref = await owned(db, target, owner, id);
      if (
        field === "productId" &&
        (data.currency ?? existing?.currency) &&
        ref.currency !== (data.currency ?? existing?.currency)
      )
        throw new ApiError(409, "currency_mismatch");
    }
  }
  if (
    resource === "units" &&
    existing &&
    ["amountCents", "productId", "status", "currency"].some(
      (field) => data[field] !== undefined && data[field] !== wire(existing)[field],
    )
  )
    throw new ApiError(409, "unit_commit_required");
}
export function prepareFinancialData(
  resource: ApiResource,
  data: Row,
  now: number,
  create: boolean,
  principal: { kind: string; keyId: string | null },
): Row {
  const timestamp = [
    "transactions",
    "transfers",
    "products",
    "units",
    "contribution-logs",
    "expense-categories",
    "recurring-expenses",
  ].includes(resource)
    ? Math.floor(now / 1000)
    : now;
  const result: Row = {
    ...data,
    updatedAt: timestamp,
    ...(create ? { createdAt: timestamp } : {}),
  };
  if ((resource === "transactions" || resource === "transfers") && typeof data.date === "string")
    Object.assign(result, dateParts(data.date));
  if (resource === "units" && create)
    result.endDate =
      data.status === "已归档"
        ? (data.endDate ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }))
        : null;
  if (resource === "contribution-logs" && create)
    result.source = principal.kind === "apiKey" ? "api" : "manual";
  if (resource === "analyses" && create)
    result.createdBy = { kind: principal.kind, keyId: principal.keyId };
  return result;
}
export async function sha256(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export async function checkedRead(
  db: D1Database,
  owner: string,
  statements: Sql[],
  analysis = false,
) {
  const rev = `SELECT coalesce((SELECT revision FROM ${analysis ? "analysis_revisions" : "owner_revisions"} WHERE owner_id=?),0) revision`;
  const batch = await db.batch<Row>([
    db.prepare(rev).bind(owner),
    ...statements.map((s) => db.prepare(s.sql).bind(...s.params)),
    db.prepare(rev).bind(owner),
  ]);
  const revision = Number(batch[0]?.results[0]?.revision);
  if (revision !== Number(batch.at(-1)?.results[0]?.revision))
    throw new ApiError(409, "dataset_changed");
  return { revision, results: batch.slice(1, -1).map((result) => result.results) };
}
