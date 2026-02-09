/**
 * E2E: MCP Tool Handlers
 *
 * Tests tool handler functions directly with a real Supabase client.
 * Each handler takes an authenticated SupabaseClient + params and returns
 * the formatted tool result.
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { createAuthenticatedClient } from "../../tests/e2e/helpers/supabase-client";
import { cleanupUser } from "../../tests/e2e/helpers/cleanup";
import { makeTransaction, makeTransfer } from "../../tests/e2e/helpers/seed";
import { queryTransactions } from "../src/tools/queryTransactions";

let client: any;
let user: any;

beforeAll(async () => {
  const auth = await createAuthenticatedClient("mcp-tools");
  client = auth.client;
  user = auth.user;

  // Seed transactions — diverse enough to test all filters
  await client.from("transactions").insert([
    makeTransaction({ note: "早餐豆浆", primary_category: "餐饮", amount: 12, type: "expense" }),
    makeTransaction({ note: "午餐外卖", primary_category: "餐饮", amount: 35, type: "expense", tags: ["工作餐"] }),
    makeTransaction({ note: "打车回家", primary_category: "交通", amount: 45, type: "expense", account: "支付宝" }),
    makeTransaction({ note: "工资收入", primary_category: "工资", amount: 15000, type: "income" }),
    makeTransaction({ note: "美股分红", primary_category: "投资", amount: 200, type: "income", currency: "美元", year: 2025, month: 6, day: 15, date: "2025-06-15" }),
    makeTransaction({ note: "年终奖金", primary_category: "工资", amount: 50000, type: "income", year: 2025, month: 12, day: 31, date: "2025-12-31" }),
  ]);

  // Seed transfers
  await client.from("transfers").insert([
    makeTransfer({ note: "还信用卡", account: "招商银行", outflow_amount: 5000, transaction_type: "转出" }),
    makeTransfer({ note: "理财赎回", account: "招商银行", inflow_amount: 10000, outflow_amount: 0, transaction_type: "转入" }),
    makeTransfer({ note: "港币兑换", account: "汇丰银行", outflow_amount: 8000, currency: "港币", year: 2025, month: 3, day: 10, date: "2025-03-10" }),
    makeTransfer({ note: "日常转账", account: "支付宝", outflow_amount: 200, tags: ["日常"] }),
  ]);
});

afterAll(async () => {
  if (user?.id) {
    await cleanupUser(user.id);
  }
});

// ============================================================================
// query_transactions tool handler
// ============================================================================

describe("queryTransactions", () => {
  it("returns all transactions when no filters provided", async () => {
    const result = await queryTransactions(client, {});

    expect(result.transactions).toBeDefined();
    expect(result.transactions.length).toBe(6);
    expect(result.total_returned).toBe(6);
  });

  it("filters by keyword (fuzzy match on note)", async () => {
    const result = await queryTransactions(client, { keyword: "豆浆" });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("早餐豆浆");
    expect(result.transactions[0].matched_field).toBe("note");
  });

  it("filters by keyword matching category", async () => {
    const result = await queryTransactions(client, { keyword: "交通" });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("打车回家");
    expect(result.transactions[0].matched_field).toBe("category");
  });

  it("filters by type", async () => {
    const result = await queryTransactions(client, { type: "income" });

    expect(result.transactions.length).toBe(3);
    result.transactions.forEach((t: { type: string }) => {
      expect(t.type).toBe("income");
    });
  });

  it("filters by categories array", async () => {
    const result = await queryTransactions(client, { categories: ["餐饮"] });

    expect(result.transactions.length).toBe(2);
    result.transactions.forEach((t: { primary_category: string }) => {
      expect(t.primary_category).toBe("餐饮");
    });
  });

  it("filters by accounts array", async () => {
    const result = await queryTransactions(client, { accounts: ["支付宝"] });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("打车回家");
  });

  it("filters by tags", async () => {
    const result = await queryTransactions(client, { tags: ["工作餐"] });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("午餐外卖");
  });

  it("filters by amount range", async () => {
    const result = await queryTransactions(client, { min_amount: 30, max_amount: 50 });

    expect(result.transactions.length).toBe(2); // 午餐35 + 打车45
    const notes = result.transactions.map((t: { note: string }) => t.note).sort();
    expect(notes).toEqual(["午餐外卖", "打车回家"]);
  });

  it("filters by year", async () => {
    const result = await queryTransactions(client, { year: 2025 });

    expect(result.transactions.length).toBe(2); // 美股分红 + 年终奖金
  });

  it("filters by year and month", async () => {
    const result = await queryTransactions(client, { year: 2025, month: 6 });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("美股分红");
  });

  it("filters by currency", async () => {
    const result = await queryTransactions(client, { currency: "美元" });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("美股分红");
  });

  it("filters by date range", async () => {
    const result = await queryTransactions(client, {
      start_date: "2025-01-01",
      end_date: "2025-12-31",
    });

    expect(result.transactions.length).toBe(2); // 美股分红 + 年终奖金
  });

  it("supports pagination with limit and offset", async () => {
    const page1 = await queryTransactions(client, { limit: 2, offset: 0 });
    expect(page1.transactions.length).toBe(2);
    expect(page1.total_returned).toBe(2);

    const page2 = await queryTransactions(client, { limit: 2, offset: 2 });
    expect(page2.transactions.length).toBe(2);

    // Pages should not overlap
    const ids1 = page1.transactions.map((t: { id: string }) => t.id);
    const ids2 = page2.transactions.map((t: { id: string }) => t.id);
    const overlap = ids1.filter((id: string) => ids2.includes(id));
    expect(overlap.length).toBe(0);
  });

  it("combines multiple filters", async () => {
    const result = await queryTransactions(client, {
      type: "income",
      year: 2025,
      currency: "美元",
    });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("美股分红");
  });

  it("returns empty array when no matches", async () => {
    const result = await queryTransactions(client, { keyword: "不存在的东西" });

    expect(result.transactions).toEqual([]);
    expect(result.total_returned).toBe(0);
  });

  it("caps limit at 500", async () => {
    const result = await queryTransactions(client, { limit: 9999 });

    // Should not error — RPC clamps to 500 internally
    expect(result.transactions.length).toBeLessThanOrEqual(500);
    expect(result.transactions.length).toBe(6); // we only have 6
  });
});
