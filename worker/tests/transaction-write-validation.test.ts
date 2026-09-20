import { describe, expect, test } from "vitest";
import {
  createTransactionSchema,
  createTransferSchema,
  dateParts,
  importTransactionRowSchema,
  updateTransactionSchema,
  updateTransferSchema,
} from "../db/validation";

const txBase = {
  date: "2026-03-15",
  primaryCategory: "餐饮",
  tertiaryCategory: "午餐",
  amountCents: 3200,
  type: "expense" as const,
  account: "招行",
};

const trBase = {
  date: "2026-03-15",
  account: "招行",
  inflowAmountCents: 1000,
  outflowAmountCents: 0,
};

describe("dateParts", () => {
  test("parses YYYY-MM-DD", () => {
    expect(dateParts("2026-03-15")).toEqual({ year: 2026, month: 3, day: 15 });
  });
});

describe("createTransactionSchema", () => {
  test("derives year/month/day and strips unknown ownership keys", () => {
    const result = createTransactionSchema.safeParse({
      ...txBase,
      id: "client-id",
      userId: "attacker",
      createdAt: 99,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      date: "2026-03-15",
      year: 2026,
      month: 3,
      day: 15,
      amountCents: 3200,
      currency: "人民币",
      tags: "[]",
    });
    expect(result.data).not.toHaveProperty("id");
    expect(result.data).not.toHaveProperty("userId");
    expect(result.data).not.toHaveProperty("createdAt");
  });

  test("rejects non-integer cents", () => {
    expect(createTransactionSchema.safeParse({ ...txBase, amountCents: 1.5 }).success).toBe(false);
  });

  test("rejects impossible calendar day", () => {
    expect(createTransactionSchema.safeParse({ ...txBase, date: "2026-02-31" }).success).toBe(
      false,
    );
  });

  test("rejects year that does not match date", () => {
    expect(createTransactionSchema.safeParse({ ...txBase, year: 2025 }).success).toBe(false);
  });

  test("rejects month or day that does not match date", () => {
    expect(createTransactionSchema.safeParse({ ...txBase, month: 4 }).success).toBe(false);
    expect(createTransactionSchema.safeParse({ ...txBase, day: 1 }).success).toBe(false);
  });

  test("keeps hasSecondaryMapping when provided", () => {
    const result = createTransactionSchema.safeParse({ ...txBase, hasSecondaryMapping: false });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hasSecondaryMapping).toBe(false);
  });

  test("accepts matching year/month/day", () => {
    const result = createTransactionSchema.safeParse({ ...txBase, year: 2026, month: 3, day: 15 });
    expect(result.success).toBe(true);
  });
});

describe("updateTransactionSchema", () => {
  test("strips unknown ownership keys and accepts a cents-only patch", () => {
    const result = updateTransactionSchema.safeParse({
      id: "keep-me",
      userId: "nope",
      createdAt: 1,
      amountCents: 50,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ amountCents: 50 });
  });

  test("identity-only body fails", () => {
    expect(updateTransactionSchema.safeParse({ id: "x", userId: "y", createdAt: 1 }).success).toBe(
      false,
    );
  });

  test("date patch fills matching year/month/day", () => {
    const result = updateTransactionSchema.safeParse({ date: "2024-01-02" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ date: "2024-01-02", year: 2024, month: 1, day: 2 });
  });

  test("rejects date/year mismatch", () => {
    expect(updateTransactionSchema.safeParse({ date: "2024-01-02", year: 2023 }).success).toBe(
      false,
    );
  });

  test("rejects year/month/day without date", () => {
    expect(updateTransactionSchema.safeParse({ year: 2024 }).success).toBe(false);
    expect(updateTransactionSchema.safeParse({ month: 1, day: 2 }).success).toBe(false);
    expect(
      updateTransactionSchema.safeParse({ year: 2024, month: 1, day: 2, amountCents: 1 }).success,
    ).toBe(false);
  });

  test("rejects non-integer cents", () => {
    expect(updateTransactionSchema.safeParse({ amountCents: 0.1 }).success).toBe(false);
  });
});

describe("createTransferSchema / updateTransferSchema", () => {
  test("create strips unknown ownership keys and defaults amounts", () => {
    const result = createTransferSchema.safeParse({
      date: trBase.date,
      account: trBase.account,
      id: "client",
      user_id: "u",
      created_at: 1,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.inflowAmountCents).toBe(0);
    expect(result.data.outflowAmountCents).toBe(0);
    expect(result.data.secondaryCategory).toBe("转账");
    expect(result.data).not.toHaveProperty("id");
  });

  test("create rejects bad cents", () => {
    expect(createTransferSchema.safeParse({ ...trBase, inflowAmountCents: 1.2 }).success).toBe(
      false,
    );
  });

  test("update identity-only fails", () => {
    expect(updateTransferSchema.safeParse({ id: "x", userId: "y" }).success).toBe(false);
  });

  test("update cents-only succeeds after unknown keys are stripped", () => {
    const result = updateTransferSchema.safeParse({ userId: "no", outflowAmountCents: 9 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ outflowAmountCents: 9 });
  });

  test("update date fills year/month/day", () => {
    const result = updateTransferSchema.safeParse({ date: "2024-01-02" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ date: "2024-01-02", year: 2024, month: 1, day: 2 });
    }
  });

  test("update date with matching parts keeps provided year", () => {
    const result = updateTransferSchema.safeParse({
      date: "2024-01-02",
      year: 2024,
      month: 1,
      day: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ year: 2024, month: 1, day: 2 });
    }
  });

  test("rejects year/month/day without date", () => {
    expect(updateTransferSchema.safeParse({ year: 2024, month: 3 }).success).toBe(false);
  });
});

describe("import row date consistency", () => {
  test("rejects import row whose date does not match y/m/d", () => {
    const result = importTransactionRowSchema.safeParse({
      ...txBase,
      year: 2026,
      month: 4,
      day: 15,
    });
    expect(result.success).toBe(false);
  });
});
