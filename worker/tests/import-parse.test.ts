import { describe, expect, test } from "vitest";
import { parseTransactionImportRow, parseTransferImportRow } from "../lib/import-parse";

const tx = {
  date: "2026-03-15",
  year: 2026,
  month: 3,
  day: 15,
  primaryCategory: "餐饮",
  tertiaryCategory: "午餐",
  amountCents: 100,
  type: "expense",
  account: "招行",
};

const tr = {
  date: "2026-03-15",
  year: 2026,
  month: 3,
  day: 15,
  account: "招行",
  inflowAmountCents: 5,
};

describe("parseTransactionImportRow", () => {
  test("always assigns a server id, ignoring client id/userId/createdAt", () => {
    const result = parseTransactionImportRow(
      { ...tx, id: "client-id", userId: "u", createdAt: 1 },
      0,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.id).not.toBe("client-id");
    expect(result.row.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.row.amountCents).toBe(100);
  });

  test("rejects invalid cents and impossible dates", () => {
    expect(parseTransactionImportRow({ ...tx, amountCents: 1.2 }, 3).ok).toBe(false);
    expect(parseTransactionImportRow({ ...tx, date: "2026-02-31", day: 31, month: 2 }, 1).ok).toBe(
      false,
    );
    const bad = parseTransactionImportRow({ ...tx, month: 4 }, 2);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain("row 2");
  });

  test("maps hasSecondaryMapping false to 0", () => {
    const result = parseTransactionImportRow({ ...tx, hasSecondaryMapping: false }, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.hasSecondaryMapping).toBe(0);
  });

  test("defaults optional transaction fields", () => {
    const result = parseTransactionImportRow(tx, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.secondaryCategory).toBeNull();
    expect(result.row.currency).toBe("人民币");
    expect(result.row.tags).toBe("[]");
    expect(result.row.note).toBeNull();
    expect(result.row.rawIndex).toBeNull();
    expect(result.row.hasSecondaryMapping).toBe(1);
  });
});

describe("parseTransferImportRow", () => {
  test("defaults optional transfer fields", () => {
    const result = parseTransferImportRow(
      {
        date: "2026-03-15",
        year: 2026,
        month: 3,
        day: 15,
        account: "招行",
      },
      0,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.primaryCategory).toBeNull();
    expect(result.row.inflowAmountCents).toBe(0);
    expect(result.row.outflowAmountCents).toBe(0);
    expect(result.row.currency).toBe("人民币");
  });

  test("always assigns a server id", () => {
    const result = parseTransferImportRow({ ...tr, id: "keep" }, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row.id).not.toBe("keep");
    expect(result.row.secondaryCategory).toBe("转账");
    expect(result.row.inflowAmountCents).toBe(5);
    expect(result.row.outflowAmountCents).toBe(0);
  });

  test("rejects invalid rows with index in the message", () => {
    const result = parseTransferImportRow({ ...tr, inflowAmountCents: 0.4 }, 9);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("row 9");
  });
});
