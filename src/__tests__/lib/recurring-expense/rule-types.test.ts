import { describe, expect, test } from "vitest";
import {
  categoryInputSchema,
  RECURRENCE_FREQUENCIES,
  recurringExpenseInputSchema,
  recurringExpenseUpdateSchema,
} from "@/lib/recurring-expense/rule-types";

const yearlyBase = {
  name: "中行车险",
  amount: 8000,
  frequency: "yearly" as const,
  interval: 1,
  monthOfYear: 1,
  dayOfMonth: 5,
  startDate: "2026-01-05",
};

describe("categoryInputSchema (P2-C1)", () => {
  test("accepts a valid chart-N color token", () => {
    const res = categoryInputSchema.safeParse({
      name: "保险",
      colorToken: "chart-9",
    });
    expect(res.success).toBe(true);
  });

  test("rejects a free-form colour like rgb()", () => {
    const res = categoryInputSchema.safeParse({
      name: "保险",
      colorToken: "rgb(255,0,0)",
    });
    expect(res.success).toBe(false);
  });

  test("rejects chart-N outside 1..24", () => {
    const res = categoryInputSchema.safeParse({
      name: "保险",
      colorToken: "chart-99",
    });
    expect(res.success).toBe(false);
  });

  test("trims and requires non-empty name", () => {
    const empty = categoryInputSchema.safeParse({
      name: "   ",
      colorToken: "chart-1",
    });
    expect(empty.success).toBe(false);

    const padded = categoryInputSchema.safeParse({
      name: "  房租  ",
      colorToken: "chart-1",
    });
    expect(padded.success).toBe(true);
    if (padded.success) {
      expect(padded.data.name).toBe("房租");
    }
  });
});

describe("recurringExpenseInputSchema (P2-C1)", () => {
  test("happy path: yearly rule with required fields", () => {
    const res = recurringExpenseInputSchema.safeParse(yearlyBase);
    expect(res.success).toBe(true);
  });

  test("defaults: currency='CNY', interval=1", () => {
    const res = recurringExpenseInputSchema.safeParse({
      ...yearlyBase,
      interval: undefined,
      currency: undefined,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.currency).toBe("CNY");
      expect(res.data.interval).toBe(1);
    }
  });

  test("rejects amount ≤ 0", () => {
    expect(recurringExpenseInputSchema.safeParse({ ...yearlyBase, amount: 0 }).success).toBe(false);
    expect(recurringExpenseInputSchema.safeParse({ ...yearlyBase, amount: -1 }).success).toBe(
      false,
    );
  });

  test("rejects startDate not ISO YYYY-MM-DD", () => {
    expect(
      recurringExpenseInputSchema.safeParse({
        ...yearlyBase,
        startDate: "2026/01/05",
      }).success,
    ).toBe(false);
    expect(
      recurringExpenseInputSchema.safeParse({
        ...yearlyBase,
        startDate: "2026-1-5",
      }).success,
    ).toBe(false);
  });

  test("rejects endDate < startDate", () => {
    const res = recurringExpenseInputSchema.safeParse({
      ...yearlyBase,
      endDate: "2025-01-04",
    });
    expect(res.success).toBe(false);
  });

  test("weekly requires weekday", () => {
    const res = recurringExpenseInputSchema.safeParse({
      ...yearlyBase,
      frequency: "weekly",
      monthOfYear: null,
      dayOfMonth: null,
      weekday: null,
    });
    expect(res.success).toBe(false);
  });

  test("monthly requires dayOfMonth", () => {
    const res = recurringExpenseInputSchema.safeParse({
      ...yearlyBase,
      frequency: "monthly",
      monthOfYear: null,
      dayOfMonth: null,
    });
    expect(res.success).toBe(false);
  });

  test("yearly requires monthOfYear AND dayOfMonth", () => {
    expect(
      recurringExpenseInputSchema.safeParse({
        ...yearlyBase,
        monthOfYear: null,
      }).success,
    ).toBe(false);
    expect(
      recurringExpenseInputSchema.safeParse({
        ...yearlyBase,
        dayOfMonth: null,
      }).success,
    ).toBe(false);
  });

  test("daily can omit weekday/dayOfMonth/monthOfYear", () => {
    const res = recurringExpenseInputSchema.safeParse({
      name: "coffee",
      amount: 35,
      frequency: "daily",
      interval: 2,
      startDate: "2026-01-01",
    });
    expect(res.success).toBe(true);
  });

  test("rejects interval < 1", () => {
    expect(recurringExpenseInputSchema.safeParse({ ...yearlyBase, interval: 0 }).success).toBe(
      false,
    );
    expect(recurringExpenseInputSchema.safeParse({ ...yearlyBase, interval: -1 }).success).toBe(
      false,
    );
  });

  test("rejects dayOfMonth out of 1..31", () => {
    expect(recurringExpenseInputSchema.safeParse({ ...yearlyBase, dayOfMonth: 0 }).success).toBe(
      false,
    );
    expect(recurringExpenseInputSchema.safeParse({ ...yearlyBase, dayOfMonth: 32 }).success).toBe(
      false,
    );
  });

  test("rejects weekday out of 0..6", () => {
    expect(
      recurringExpenseInputSchema.safeParse({
        ...yearlyBase,
        frequency: "weekly",
        weekday: 7,
      }).success,
    ).toBe(false);
  });

  test("input schema does NOT accept status / endedAt (state-machine protection)", () => {
    const res = recurringExpenseInputSchema.safeParse({
      ...yearlyBase,
      status: "paused",
      endedAt: "2026-06-07",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      // Even if user POSTs these, they're stripped from the parsed object
      expect("status" in res.data).toBe(false);
      expect("endedAt" in res.data).toBe(false);
    }
  });

  test("frequency enum covers all 4 values", () => {
    expect(RECURRENCE_FREQUENCIES).toEqual(["daily", "weekly", "monthly", "yearly"]);
  });
});

describe("recurringExpenseUpdateSchema (P2-C1)", () => {
  test("partial updates ok", () => {
    const res = recurringExpenseUpdateSchema.safeParse({ name: "new" });
    expect(res.success).toBe(true);
  });

  test("does NOT accept status / endedAt", () => {
    const res = recurringExpenseUpdateSchema.safeParse({
      name: "new",
      status: "ended",
      endedAt: "2026-06-07",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect("status" in res.data).toBe(false);
      expect("endedAt" in res.data).toBe(false);
    }
  });

  test("empty object rejected by Server Action layer, but schema accepts it", () => {
    // No required fields — caller is responsible for not posting empty.
    const res = recurringExpenseUpdateSchema.safeParse({});
    expect(res.success).toBe(true);
  });
});
