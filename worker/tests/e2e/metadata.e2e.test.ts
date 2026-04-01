import { describe, test, expect, beforeEach } from "bun:test";
import { api, TEST_USER_A } from "./helpers/client";
import { cleanupUser } from "./helpers/cleanup";
import { makeTransaction, makeTransfer } from "./helpers/seed";

const userId = TEST_USER_A;

describe("E2E: Metadata", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  test("GET /api/reports/metadata returns empty when no data", async () => {
    const res = await api<Record<string, unknown>>({
      method: "GET",
      path: "/api/reports/metadata",
      userId,
    });
    expect(res.transaction_count).toBe(0);
    expect(res.transfer_count).toBe(0);
    expect(res.years).toEqual([]);
  });

  test("GET /api/reports/metadata reflects inserted transactions", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ year: 2025, account: "招商银行" }),
    });
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ year: 2024, account: "平安银行", date: "2024-03-15" }),
    });

    const res = await api<Record<string, unknown>>({
      method: "GET",
      path: "/api/reports/metadata",
      userId,
    });
    expect(res.transaction_count).toBe(2);
    expect((res.years as number[]).sort((a, b) => b - a)).toEqual([2025, 2024]);
    expect((res.accounts as string[]).sort()).toEqual(["平安银行", "招商银行"]);
  });

  test("GET /api/reports/metadata includes transfer counts", async () => {
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer(),
    });

    const res = await api<Record<string, unknown>>({
      method: "GET",
      path: "/api/reports/metadata",
      userId,
    });
    expect(res.transfer_count).toBe(1);
  });

  test("GET /api/reports/metadata returns categories and tags", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({
        primaryCategory: "餐饮",
        secondaryCategory: "外卖",
        tertiaryCategory: "午餐",
        tags: '["daily","food"]',
      }),
    });

    const res = await api<Record<string, unknown>>({
      method: "GET",
      path: "/api/reports/metadata",
      userId,
    });
    expect((res.categories as string[])).toContain("餐饮");
    expect((res.tags as string[])).toContain("daily");
    expect((res.tags as string[])).toContain("food");
  });
});
