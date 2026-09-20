/** D1 bound JSON value limit is 2,000,000 bytes; stay well under with 512 KiB chunks. */
export const JSON_CHUNK_BYTES = 512 * 1024;
/** D1 per-value hard limit (decimal 2,000,000 bytes, not 2 MiB). */
export const D1_MAX_VALUE_BYTES = 2_000_000;
/**
 * Request payload ceiling before any delete/insert.
 * Covers the measured 4.25 MiB coordinator backup with headroom.
 */
export const MAX_IMPORT_BODY_BYTES = 8 * 1024 * 1024;
/**
 * Floor required by production (max 2008 tx/user/year, 8158 total) plus backup.
 * json_each chunks avoid the 100-bind cap, so this is a body-size companion, not
 * a D1 parameter math leftover.
 */
export const MAX_IMPORT_ROWS = 20_000;

export interface SqlStatement {
  sql: string;
  params: unknown[];
}

export type ImportValidationFailure =
  | "invalid_year"
  | "invalid_rows"
  | "excessive"
  | "row_invalid"
  | "year_mismatch";

export type ImportValidation<T> =
  | { ok: true; rows: T[] }
  | { ok: false; reason: ImportValidationFailure; message: string };

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function isImportYear(year: unknown): year is number {
  return typeof year === "number" && Number.isInteger(year) && year >= 1900 && year <= 2100;
}

export function validateRowList<T>(
  rows: unknown,
  parseRow: (row: unknown, index: number) => { ok: true; row: T } | { ok: false; message: string },
): ImportValidation<T> {
  if (!Array.isArray(rows)) {
    return { ok: false, reason: "invalid_rows", message: "rows must be an array" };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      reason: "excessive",
      message: `rows exceed maximum of ${MAX_IMPORT_ROWS}`,
    };
  }
  const parsed: T[] = [];
  for (let i = 0; i < rows.length; i++) {
    const result = parseRow(rows[i], i);
    if (!result.ok) {
      return { ok: false, reason: "row_invalid", message: result.message };
    }
    parsed.push(result.row);
  }
  return { ok: true, rows: parsed };
}

export function validateImportEnvelope<T>(
  year: unknown,
  rows: unknown,
  parseRow: (row: unknown, index: number) => { ok: true; row: T } | { ok: false; message: string },
  rowYear: (row: T) => number,
): ImportValidation<T> {
  if (!isImportYear(year)) {
    return { ok: false, reason: "invalid_year", message: "year must be an integer" };
  }
  if (!Array.isArray(rows)) {
    return { ok: false, reason: "invalid_rows", message: "rows must be an array" };
  }
  if (rows.length === 0) {
    return { ok: false, reason: "invalid_rows", message: "rows must not be empty" };
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      reason: "excessive",
      message: `rows exceed maximum of ${MAX_IMPORT_ROWS}`,
    };
  }

  const parsed: T[] = [];
  for (let i = 0; i < rows.length; i++) {
    const result = parseRow(rows[i], i);
    if (!result.ok) {
      return { ok: false, reason: "row_invalid", message: result.message };
    }
    if (rowYear(result.row) !== year) {
      return {
        ok: false,
        reason: "year_mismatch",
        message: `row ${i} year does not match import year`,
      };
    }
    parsed.push(result.row);
  }
  return { ok: true, rows: parsed };
}

export function payloadExceedsBodyMax(jsonParts: string[]): boolean {
  let total = 0;
  for (const part of jsonParts) {
    total += utf8ByteLength(part);
    if (total > MAX_IMPORT_BODY_BYTES) return true;
  }
  return false;
}

/**
 * Pack already-validated row objects into JSON array strings ≤ JSON_CHUNK_BYTES.
 * A single oversize row is allowed up to D1_MAX_VALUE_BYTES; larger is rejected.
 */
export function chunkJsonArrays(rows: unknown[]): { ok: true; chunks: string[] } | { ok: false } {
  const chunks: string[] = [];
  let bucket: unknown[] = [];
  let bucketBytes = 2;

  const flush = () => {
    if (bucket.length === 0) return;
    chunks.push(JSON.stringify(bucket));
    bucket = [];
    bucketBytes = 2;
  };

  for (const row of rows) {
    const piece = JSON.stringify(row);
    const pieceBytes = utf8ByteLength(piece);
    if (pieceBytes > D1_MAX_VALUE_BYTES - 2) {
      return { ok: false };
    }
    const extra = bucket.length === 0 ? pieceBytes : pieceBytes + 1;
    if (bucket.length > 0 && bucketBytes + extra > JSON_CHUNK_BYTES) {
      flush();
    }
    if (bucket.length === 0 && pieceBytes + 2 > JSON_CHUNK_BYTES) {
      chunks.push(`[${piece}]`);
      continue;
    }
    bucket.push(row);
    bucketBytes += extra;
  }
  flush();
  return { ok: true, chunks };
}

export interface NormalizedTransactionRow {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  primaryCategory: string;
  secondaryCategory: string | null;
  tertiaryCategory: string;
  amountCents: number;
  type: string;
  account: string;
  currency: string;
  tags: string;
  note: string | null;
  rawIndex: number | null;
  hasSecondaryMapping: number;
}

export interface NormalizedTransferRow {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  primaryCategory: string | null;
  secondaryCategory: string | null;
  transactionType: string | null;
  inflowAmountCents: number;
  outflowAmountCents: number;
  currency: string;
  account: string;
  tags: string;
  note: string | null;
  rawIndex: number | null;
}

export function transactionJsonRow(row: NormalizedTransactionRow): Record<string, unknown> {
  return {
    id: row.id,
    date: row.date,
    year: row.year,
    month: row.month,
    day: row.day,
    primary_category: row.primaryCategory,
    secondary_category: row.secondaryCategory,
    tertiary_category: row.tertiaryCategory,
    amount_cents: row.amountCents,
    type: row.type,
    account: row.account,
    currency: row.currency,
    tags: row.tags,
    note: row.note,
    raw_index: row.rawIndex,
    has_secondary_mapping: row.hasSecondaryMapping,
  };
}

export function transferJsonRow(row: NormalizedTransferRow): Record<string, unknown> {
  return {
    id: row.id,
    date: row.date,
    year: row.year,
    month: row.month,
    day: row.day,
    primary_category: row.primaryCategory,
    secondary_category: row.secondaryCategory,
    transaction_type: row.transactionType,
    inflow_amount_cents: row.inflowAmountCents,
    outflow_amount_cents: row.outflowAmountCents,
    currency: row.currency,
    account: row.account,
    tags: row.tags,
    note: row.note,
    raw_index: row.rawIndex,
  };
}

export function transactionInsertFromJsonSql(): string {
  return `INSERT INTO transactions (
    id, user_id, date, year, month, day, primary_category, secondary_category,
    tertiary_category, amount_cents, type, account, currency, tags, note,
    raw_index, has_secondary_mapping, created_at
  )
  SELECT
    json_extract(value, '$.id'),
    ?,
    json_extract(value, '$.date'),
    json_extract(value, '$.year'),
    json_extract(value, '$.month'),
    json_extract(value, '$.day'),
    json_extract(value, '$.primary_category'),
    json_extract(value, '$.secondary_category'),
    json_extract(value, '$.tertiary_category'),
    json_extract(value, '$.amount_cents'),
    json_extract(value, '$.type'),
    json_extract(value, '$.account'),
    json_extract(value, '$.currency'),
    json_extract(value, '$.tags'),
    json_extract(value, '$.note'),
    json_extract(value, '$.raw_index'),
    json_extract(value, '$.has_secondary_mapping'),
    ?
  FROM json_each(?)`;
}

export function transferInsertFromJsonSql(): string {
  return `INSERT INTO transfers (
    id, user_id, date, year, month, day, primary_category, secondary_category,
    transaction_type, inflow_amount_cents, outflow_amount_cents, currency,
    account, tags, note, raw_index, created_at
  )
  SELECT
    json_extract(value, '$.id'),
    ?,
    json_extract(value, '$.date'),
    json_extract(value, '$.year'),
    json_extract(value, '$.month'),
    json_extract(value, '$.day'),
    json_extract(value, '$.primary_category'),
    json_extract(value, '$.secondary_category'),
    json_extract(value, '$.transaction_type'),
    json_extract(value, '$.inflow_amount_cents'),
    json_extract(value, '$.outflow_amount_cents'),
    json_extract(value, '$.currency'),
    json_extract(value, '$.account'),
    json_extract(value, '$.tags'),
    json_extract(value, '$.note'),
    json_extract(value, '$.raw_index'),
    ?
  FROM json_each(?)`;
}

export function buildYearReplaceStatements(input: {
  table: "transactions" | "transfers";
  userId: string;
  year: number;
  chunks: string[];
  createdAt: number;
}): SqlStatement[] {
  const insertSql =
    input.table === "transactions" ? transactionInsertFromJsonSql() : transferInsertFromJsonSql();
  const statements: SqlStatement[] = [
    {
      sql: `DELETE FROM ${input.table} WHERE user_id = ? AND year = ?`,
      params: [input.userId, input.year],
    },
  ];
  for (const chunk of input.chunks) {
    statements.push({
      sql: insertSql,
      params: [input.userId, input.createdAt, chunk],
    });
  }
  return statements;
}

export function buildUserReplaceStatements(input: {
  table: "transactions" | "transfers";
  userId: string;
  chunks: string[];
  createdAt: number;
}): SqlStatement[] {
  const insertSql =
    input.table === "transactions" ? transactionInsertFromJsonSql() : transferInsertFromJsonSql();
  const statements: SqlStatement[] = [
    {
      sql: `DELETE FROM ${input.table} WHERE user_id = ?`,
      params: [input.userId],
    },
  ];
  for (const chunk of input.chunks) {
    statements.push({
      sql: insertSql,
      params: [input.userId, input.createdAt, chunk],
    });
  }
  return statements;
}
