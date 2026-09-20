import { describe, expect, test } from "vitest";
import { createRecurringExpenseSchema, updateRecurringExpenseSchema } from "../db/validation";

const base = { name: "Rule", amountCents: 100, startDate: "2026-09-01" };

describe("recurring schedule validation", () => {
  test.each([
    { frequency: "daily" },
    { frequency: "weekly", weekday: 0 },
    { frequency: "monthly", dayOfMonth: 31 },
    { frequency: "yearly", monthOfYear: 2, dayOfMonth: 29 },
    { frequency: "daily", endDate: "2026-09-01" },
  ])("accepts a complete schedule: %j", (schedule) => {
    expect(createRecurringExpenseSchema.safeParse({ ...base, ...schedule }).success).toBe(true);
  });

  test.each([
    { frequency: "weekly" },
    { frequency: "monthly" },
    { frequency: "yearly", dayOfMonth: 1 },
    { frequency: "yearly", monthOfYear: 1 },
    { frequency: "daily", endDate: "2026-08-31" },
    { frequency: "daily", startDate: "2026-02-30" },
    { frequency: "daily", endDate: "2026-09-31" },
  ])("rejects an invalid schedule: %j", (schedule) => {
    expect(createRecurringExpenseSchema.safeParse({ ...base, ...schedule }).success).toBe(false);
  });

  test("partial updates preserve defaults and discard lifecycle authority", () => {
    expect(
      updateRecurringExpenseSchema.parse({ name: "Renamed", status: "ended", endedAt: null }),
    ).toEqual({ name: "Renamed" });
  });
});
