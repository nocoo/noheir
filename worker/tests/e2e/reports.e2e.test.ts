import { describe, test, expect, beforeEach } from "bun:test";
import { api, rawFetch, TEST_USER_A } from "./helpers/client";
import { cleanupUser } from "./helpers/cleanup";
import { makeTransaction, makeTransfer } from "./helpers/seed";

const userId = TEST_USER_A;

describe("E2E: Reports", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  test("GET /api/reports/monthly returns 400 without year/month", async () => {
    const res = await rawFetch({
      method: "GET",
      path: "/api/reports/monthly",
      userId,
    });
    expect(res.status).toBe(400);
  });

  test("GET /api/reports/monthly returns zeros when no data", async () => {
    const res = await api<Record<string, unknown>>({
      method: "GET",
      path: "/api/reports/monthly?year=2025&month=6",
      userId,
    });
    expect(res.total_income).toBe(0);
    expect(res.total_expense).toBe(0);
    expect(res.transaction_count).toBe(0);
  });

  test("GET /api/reports/monthly aggregates correctly", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({
        type: "income",
        amountCents: 1000000,
        primaryCategory: "工资",
        year: 2025,
        month: 6,
      }),
    });
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({
        type: "expense",
        amountCents: 5000,
        primaryCategory: "餐饮",
        year: 2025,
        month: 6,
      }),
    });
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({
        year: 2025,
        month: 6,
        inflowAmountCents: 50000,
        outflowAmountCents: 0,
      }),
    });

    const res = await api<Record<string, unknown>>({
      method: "GET",
      path: "/api/reports/monthly?year=2025&month=6",
      userId,
    });
    expect(res.total_income).toBe(1000000);
    expect(res.total_expense).toBe(5000);
    expect(res.transaction_count).toBe(2);
    expect(res.transfer_count).toBe(1);
    expect(res.total_transfer_in).toBe(50000);
  });

  test("GET /api/reports/monthly returns category breakdowns", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({
        type: "expense",
        amountCents: 3000,
        primaryCategory: "餐饮",
        year: 2025,
        month: 6,
      }),
    });
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({
        type: "expense",
        amountCents: 7000,
        primaryCategory: "交通",
        year: 2025,
        month: 6,
      }),
    });

    const res = await api<{
      expense_by_category: Array<{ category: string; total: number }>;
    }>({
      method: "GET",
      path: "/api/reports/monthly?year=2025&month=6",
      userId,
    });
    expect(res.expense_by_category).toHaveLength(2);
    // Sorted DESC by total
    expect(res.expense_by_category[0]!.category).toBe("交通");
    expect(res.expense_by_category[0]!.total).toBe(7000);
  });

  test("GET /api/reports/monthly ignores other months", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ year: 2025, month: 6, amountCents: 1000 }),
    });
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ year: 2025, month: 7, date: "2025-07-15", amountCents: 9999 }),
    });

    const res = await api<Record<string, unknown>>({
      method: "GET",
      path: "/api/reports/monthly?year=2025&month=6",
      userId,
    });
    expect(res.transaction_count).toBe(1);
  });
});
