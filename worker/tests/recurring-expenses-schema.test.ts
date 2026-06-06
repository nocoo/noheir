// P1-C1 type-only smoke: ensures schema definitions compile and produce
// the expected Drizzle table shape. Full repository CRUD tests land in
// P1-C3 (`expense-categories.test.ts`).

import { describe, expect, test } from "vitest";
import { expenseCategories, recurringExpenses } from "../db/schema";

describe("expense_categories schema (P1-C1)", () => {
  test("table name + key columns exposed via Drizzle metadata", () => {
    const cols = Object.keys(expenseCategories);
    expect(cols).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "name",
        "colorToken",
        "sortOrder",
        "createdAt",
        "updatedAt",
      ]),
    );
  });
});

describe("recurring_expenses schema (P1-C1)", () => {
  test("table exposes recurrence + lifecycle columns", () => {
    const cols = Object.keys(recurringExpenses);
    expect(cols).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "name",
        "categoryId",
        "amountCents",
        "currency",
        "account",
        "frequency",
        "interval",
        "dayOfMonth",
        "monthOfYear",
        "weekday",
        "startDate",
        "endDate",
        "status",
        "endedAt",
        "note",
      ]),
    );
  });
});
