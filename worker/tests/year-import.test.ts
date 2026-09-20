import { describe, expect, test } from "vitest";
import {
  buildUserReplaceStatements,
  buildYearReplaceStatements,
  chunkJsonArrays,
  D1_MAX_VALUE_BYTES,
  isImportYear,
  JSON_CHUNK_BYTES,
  MAX_IMPORT_BODY_BYTES,
  MAX_IMPORT_ROWS,
  type NormalizedTransactionRow,
  payloadExceedsBodyMax,
  transactionInsertFromJsonSql,
  transactionJsonRow,
  transferInsertFromJsonSql,
  transferJsonRow,
  utf8ByteLength,
  validateImportEnvelope,
  validateRowList,
} from "../lib/year-import";

const sampleTx: NormalizedTransactionRow = {
  id: "id-1",
  date: "2026-03-15",
  year: 2026,
  month: 3,
  day: 15,
  primaryCategory: "餐饮",
  secondaryCategory: null,
  tertiaryCategory: "午餐",
  amountCents: 100,
  type: "expense",
  account: "招行",
  currency: "人民币",
  tags: "[]",
  note: null,
  rawIndex: null,
  hasSecondaryMapping: 1,
};

function parseOk(row: unknown, _index: number): { ok: true; row: { year: number } } {
  if (row && typeof row === "object" && "year" in row && typeof row.year === "number") {
    return { ok: true, row: { year: row.year } };
  }
  return { ok: true, row: { year: 0 } };
}

describe("import year / envelope", () => {
  test("accepts 1900 and 2100, rejects out of range", () => {
    expect(isImportYear(1900)).toBe(true);
    expect(isImportYear(2100)).toBe(true);
    expect(isImportYear(1899)).toBe(false);
    expect(isImportYear(2101)).toBe(false);
    expect(isImportYear(2026.5)).toBe(false);
    expect(isImportYear("2026")).toBe(false);
  });

  test("annual import empty array fails", () => {
    const result = validateImportEnvelope(2026, [], parseOk, (row) => row.year);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_rows");
  });

  test("restore empty array is valid and clears via DELETE only", () => {
    const result = validateRowList([], parseOk);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([]);
    const statements = buildUserReplaceStatements({
      table: "transactions",
      userId: "u1",
      chunks: [],
      createdAt: 1,
    });
    expect(statements).toHaveLength(1);
    expect(statements[0]?.sql).toBe("DELETE FROM transactions WHERE user_id = ?");
    expect(statements[0]?.params).toEqual(["u1"]);
  });

  test("year mismatch and invalid year fail before any SQL", () => {
    expect(validateImportEnvelope("2026", [{ year: 2026 }], parseOk, (r) => r.year).ok).toBe(false);
    const mismatch = validateImportEnvelope(2026, [{ year: 2025 }], parseOk, (r) => r.year);
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.reason).toBe("year_mismatch");
  });

  test("non-array rows fail", () => {
    expect(validateImportEnvelope(2026, null, parseOk, (r) => r.year).ok).toBe(false);
    expect(validateRowList({}, parseOk).ok).toBe(false);
  });

  test("row parse failure is row_invalid", () => {
    const result = validateRowList([1], () => ({ ok: false as const, message: "bad" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("row_invalid");
  });

  test("restore non-empty list parses and user replace inserts json_each chunks", () => {
    const result = validateRowList([{ year: 2026 }], parseOk);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const statements = buildUserReplaceStatements({
      table: "transfers",
      userId: "u1",
      chunks: ["[{}]"],
      createdAt: 9,
    });
    expect(statements).toHaveLength(2);
    expect(statements[1]?.sql).toBe(transferInsertFromJsonSql());
    expect(statements[1]?.params).toEqual(["u1", 9, "[{}]"]);
  });

  test("annual import row parse failure is row_invalid", () => {
    const result = validateImportEnvelope(
      2026,
      [{ year: 2026 }],
      () => ({ ok: false as const, message: "bad row" }),
      (row) => row.year,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("row_invalid");
  });

  test("does not invent a 2000 or 4995 row cap; 10k annual rows are accepted", () => {
    expect(MAX_IMPORT_ROWS).toBe(20_000);
    const rows = Array.from({ length: 10_000 }, () => ({ year: 2026 }));
    const annual = validateImportEnvelope(2026, rows, parseOk, (r) => r.year);
    expect(annual.ok).toBe(true);
    if (annual.ok) expect(annual.rows).toHaveLength(10_000);
    const tooMany = validateImportEnvelope(
      2026,
      Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({ year: 2026 })),
      parseOk,
      (r) => r.year,
    );
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.reason).toBe("excessive");
    expect(
      validateRowList(
        Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({ year: 1 })),
        parseOk,
      ).ok,
    ).toBe(false);
  });
});

describe("json_each chunking", () => {
  test("packs rows into JSON arrays at or under 512 KiB", () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ i, pad: "x".repeat(80) }));
    const chunked = chunkJsonArrays(rows);
    expect(chunked.ok).toBe(true);
    if (!chunked.ok) return;
    expect(chunked.chunks.length).toBeGreaterThan(0);
    for (const chunk of chunked.chunks) {
      expect(utf8ByteLength(chunk)).toBeLessThanOrEqual(JSON_CHUNK_BYTES);
      expect(JSON.parse(chunk)).toBeInstanceOf(Array);
    }
  });

  test("D1 per-value limit is decimal 2,000,000 bytes", () => {
    expect(D1_MAX_VALUE_BYTES).toBe(2_000_000);
    expect(D1_MAX_VALUE_BYTES).not.toBe(2 * 1024 * 1024);
  });

  test("allows a single row between 512 KiB and the D1 value max", () => {
    const big = { blob: "a".repeat(JSON_CHUNK_BYTES) };
    const chunked = chunkJsonArrays([big]);
    expect(chunked.ok).toBe(true);
    if (!chunked.ok) return;
    expect(chunked.chunks).toHaveLength(1);
    expect(utf8ByteLength(chunked.chunks[0] ?? "")).toBeGreaterThan(JSON_CHUNK_BYTES);
    expect(utf8ByteLength(chunked.chunks[0] ?? "")).toBeLessThanOrEqual(D1_MAX_VALUE_BYTES);
  });

  test("rejects a single row above the D1 value max", () => {
    const huge = { blob: "a".repeat(D1_MAX_VALUE_BYTES) };
    expect(chunkJsonArrays([huge]).ok).toBe(false);
  });

  test("splits when adding a row would exceed 512 KiB", () => {
    const piece = { blob: "b".repeat(300 * 1024) };
    const chunked = chunkJsonArrays([piece, piece]);
    expect(chunked.ok).toBe(true);
    if (!chunked.ok) return;
    expect(chunked.chunks.length).toBe(2);
  });
});

describe("replace statements", () => {
  test("year replace is DELETE then json_each inserts in one statement list", () => {
    const chunked = chunkJsonArrays([transactionJsonRow(sampleTx)]);
    expect(chunked.ok).toBe(true);
    if (!chunked.ok) return;
    const statements = buildYearReplaceStatements({
      table: "transactions",
      userId: "u1",
      year: 2026,
      chunks: chunked.chunks,
      createdAt: 42,
    });
    expect(statements[0]?.sql).toBe("DELETE FROM transactions WHERE user_id = ? AND year = ?");
    expect(statements[0]?.params).toEqual(["u1", 2026]);
    expect(statements[1]?.sql).toBe(transactionInsertFromJsonSql());
    expect(statements[1]?.sql).toContain("FROM json_each(?)");
    expect(statements[1]?.params).toEqual(["u1", 42, chunked.chunks[0]]);
  });

  test("transfer year replace uses transfer json_each SQL", () => {
    const statements = buildYearReplaceStatements({
      table: "transfers",
      userId: "u1",
      year: 2026,
      chunks: ["[]"],
      createdAt: 1,
    });
    expect(statements[1]?.sql).toBe(transferInsertFromJsonSql());
    expect(
      transferJsonRow({
        id: "t",
        date: "2026-01-01",
        year: 2026,
        month: 1,
        day: 1,
        primaryCategory: null,
        secondaryCategory: "转账",
        transactionType: null,
        inflowAmountCents: 1,
        outflowAmountCents: 2,
        currency: "人民币",
        account: "a",
        tags: "[]",
        note: null,
        rawIndex: null,
      }),
    ).toMatchObject({ inflow_amount_cents: 1, outflow_amount_cents: 2 });
  });
});

describe("payload ceiling", () => {
  test("8 MiB body ceiling is independent of a fake 2000-row cap", () => {
    expect(MAX_IMPORT_BODY_BYTES).toBe(8 * 1024 * 1024);
    expect(payloadExceedsBodyMax(["abc"])).toBe(false);
    expect(payloadExceedsBodyMax(["a".repeat(MAX_IMPORT_BODY_BYTES + 1)])).toBe(true);
    expect(
      payloadExceedsBodyMax([
        "a".repeat(MAX_IMPORT_BODY_BYTES / 2),
        "b".repeat(MAX_IMPORT_BODY_BYTES / 2 + 2),
      ]),
    ).toBe(true);
  });
});
