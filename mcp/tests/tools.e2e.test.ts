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
import { queryTransfers } from "../src/tools/queryTransfers";
import { getSummary } from "../src/tools/getSummary";

/* eslint-disable @typescript-eslint/no-explicit-any -- root and mcp have separate @supabase/supabase-js instances causing structural type mismatch */
let client: any;
let user: any;
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(async () => {
  const auth = await createAuthenticatedClient("mcp-tools");
  client = auth.client;
  user = auth.user;

  // Seed transactions — diverse enough to test all filters
  await client.from("transactions").insert([
    makeTransaction({ note: "早餐豆浆", primary_category: "餐饮", secondary_category: "早餐", tertiary_category: "豆浆", amount: 12, type: "expense" }),
    makeTransaction({ note: "午餐外卖", primary_category: "餐饮", secondary_category: "外卖", tertiary_category: "午餐", amount: 35, type: "expense", tags: ["工作餐"] }),
    makeTransaction({ note: "打车回家", primary_category: "交通", secondary_category: "出租车", tertiary_category: "市内", amount: 45, type: "expense", account: "支付宝" }),
    makeTransaction({ note: "工资收入", primary_category: "工资", secondary_category: "月薪", tertiary_category: "基本工资", amount: 15000, type: "income" }),
    makeTransaction({ note: "美股分红", primary_category: "投资", secondary_category: "股票", tertiary_category: "分红", amount: 200, type: "income", currency: "美元", year: 2025, month: 6, day: 15, date: "2025-06-15" }),
    makeTransaction({ note: "年终奖金", primary_category: "工资", secondary_category: "奖金", tertiary_category: "年终", amount: 50000, type: "income", year: 2025, month: 12, day: 31, date: "2025-12-31" }),
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

  // --------------------------------------------------------------------------
  // Secondary / tertiary category filters
  // --------------------------------------------------------------------------

  it("filters by secondary_categories array", async () => {
    const result = await queryTransactions(client, { secondary_categories: ["外卖"] });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("午餐外卖");
    expect(result.transactions[0].secondary_category).toBe("外卖");
  });

  it("filters by tertiary_categories array", async () => {
    const result = await queryTransactions(client, { tertiary_categories: ["分红"] });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("美股分红");
    expect(result.transactions[0].tertiary_category).toBe("分红");
  });

  it("filters by multiple secondary_categories", async () => {
    const result = await queryTransactions(client, { secondary_categories: ["早餐", "外卖"] });

    expect(result.transactions.length).toBe(2);
    const notes = result.transactions.map((t: { note: string }) => t.note).sort();
    expect(notes).toEqual(["午餐外卖", "早餐豆浆"]);
  });

  // --------------------------------------------------------------------------
  // matched_field fix: secondary_category / tertiary_category
  // --------------------------------------------------------------------------

  it("keyword matching secondary_category returns matched_field='secondary_category'", async () => {
    const result = await queryTransactions(client, { keyword: "出租车" });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("打车回家");
    expect(result.transactions[0].matched_field).toBe("secondary_category");
  });

  it("keyword matching tertiary_category returns matched_field='tertiary_category'", async () => {
    const result = await queryTransactions(client, { keyword: "基本工资" });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("工资收入");
    expect(result.transactions[0].matched_field).toBe("tertiary_category");
  });

  // --------------------------------------------------------------------------
  // Combination filters — exhaustive cross-dimension tests
  // --------------------------------------------------------------------------

  it("combines keyword + year + categories", async () => {
    const result = await queryTransactions(client, {
      keyword: "奖",
      year: 2025,
      categories: ["工资"],
    });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("年终奖金");
  });

  it("combines keyword + year + month + type", async () => {
    const result = await queryTransactions(client, {
      keyword: "分红",
      year: 2025,
      month: 6,
      type: "income",
    });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("美股分红");
  });

  it("combines categories + accounts + type", async () => {
    const result = await queryTransactions(client, {
      categories: ["餐饮"],
      accounts: ["招商银行"],
      type: "expense",
    });

    expect(result.transactions.length).toBe(2);
    const notes = result.transactions.map((t: { note: string }) => t.note).sort();
    expect(notes).toEqual(["午餐外卖", "早餐豆浆"]);
  });

  it("combines secondary_categories + year", async () => {
    const result = await queryTransactions(client, {
      secondary_categories: ["股票"],
      year: 2025,
    });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("美股分红");
  });

  it("combines keyword + amount range + currency", async () => {
    const result = await queryTransactions(client, {
      keyword: "分红",
      min_amount: 100,
      currency: "美元",
    });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("美股分红");
  });

  it("combines categories + tags + keyword", async () => {
    const result = await queryTransactions(client, {
      categories: ["餐饮"],
      tags: ["工作餐"],
      keyword: "外卖",
    });

    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].note).toBe("午餐外卖");
  });

  it("returns empty when filters are mutually exclusive", async () => {
    // 餐饮 records are all expense, so type=income + categories=餐饮 → 0
    const result = await queryTransactions(client, {
      type: "income",
      categories: ["餐饮"],
    });

    expect(result.transactions).toEqual([]);
    expect(result.total_returned).toBe(0);
  });
});

// ============================================================================
// query_transfers tool handler
// ============================================================================

describe("queryTransfers", () => {
  it("returns all transfers when no filters provided", async () => {
    const result = await queryTransfers(client, {});

    expect(result.transfers).toBeDefined();
    expect(result.transfers.length).toBe(4);
    expect(result.total_returned).toBe(4);
  });

  it("filters by keyword (fuzzy match on note)", async () => {
    const result = await queryTransfers(client, { keyword: "信用卡" });

    expect(result.transfers.length).toBe(1);
    expect(result.transfers[0].note).toBe("还信用卡");
    expect(result.transfers[0].matched_field).toBe("note");
  });

  it("filters by keyword matching account", async () => {
    const result = await queryTransfers(client, { keyword: "汇丰" });

    expect(result.transfers.length).toBe(1);
    expect(result.transfers[0].note).toBe("港币兑换");
    expect(result.transfers[0].matched_field).toBe("account");
  });

  it("filters by accounts array", async () => {
    const result = await queryTransfers(client, { accounts: ["招商银行"] });

    expect(result.transfers.length).toBe(2); // 还信用卡 + 理财赎回
  });

  it("filters by transaction_type", async () => {
    const result = await queryTransfers(client, { transaction_type: "转入" });

    expect(result.transfers.length).toBe(1);
    expect(result.transfers[0].note).toBe("理财赎回");
  });

  it("filters by tags", async () => {
    const result = await queryTransfers(client, { tags: ["日常"] });

    expect(result.transfers.length).toBe(1);
    expect(result.transfers[0].note).toBe("日常转账");
  });

  it("filters by amount range (GREATEST of inflow/outflow)", async () => {
    const result = await queryTransfers(client, { min_amount: 6000, max_amount: 15000 });

    expect(result.transfers.length).toBe(2); // 理财赎回 10000 + 港币兑换 8000
    const notes = result.transfers.map((t: { note: string }) => t.note).sort();
    expect(notes).toEqual(["港币兑换", "理财赎回"]);
  });

  it("filters by year", async () => {
    const result = await queryTransfers(client, { year: 2025 });

    expect(result.transfers.length).toBe(1);
    expect(result.transfers[0].note).toBe("港币兑换");
  });

  it("filters by currency", async () => {
    const result = await queryTransfers(client, { currency: "港币" });

    expect(result.transfers.length).toBe(1);
    expect(result.transfers[0].account).toBe("汇丰银行");
  });

  it("filters by date range", async () => {
    const result = await queryTransfers(client, {
      start_date: "2026-01-01",
      end_date: "2026-12-31",
    });

    expect(result.transfers.length).toBe(3); // 还信用卡, 理财赎回, 日常转账
  });

  it("supports pagination with limit and offset", async () => {
    const page1 = await queryTransfers(client, { limit: 2, offset: 0 });
    expect(page1.transfers.length).toBe(2);

    const page2 = await queryTransfers(client, { limit: 2, offset: 2 });
    expect(page2.transfers.length).toBe(2);

    // Pages should not overlap
    const ids1 = page1.transfers.map((t: { id: string }) => t.id);
    const ids2 = page2.transfers.map((t: { id: string }) => t.id);
    const overlap = ids1.filter((id: string) => ids2.includes(id));
    expect(overlap.length).toBe(0);
  });

  it("combines multiple filters", async () => {
    const result = await queryTransfers(client, {
      accounts: ["招商银行"],
      transaction_type: "转出",
    });

    expect(result.transfers.length).toBe(1);
    expect(result.transfers[0].note).toBe("还信用卡");
  });

  it("returns empty array when no matches", async () => {
    const result = await queryTransfers(client, { keyword: "不存在的东西" });

    expect(result.transfers).toEqual([]);
    expect(result.total_returned).toBe(0);
  });
});

// ============================================================================
// get_summary tool handler
// ============================================================================

describe("getSummary", () => {
  it("returns all metadata fields", async () => {
    const result = await getSummary(client);

    expect(result.years).toBeDefined();
    expect(result.accounts).toBeDefined();
    expect(result.categories).toBeDefined();
    expect(result.secondary_categories).toBeDefined();
    expect(result.tertiary_categories).toBeDefined();
    expect(result.currencies).toBeDefined();
    expect(result.tags).toBeDefined();
    expect(result.transaction_count).toBeDefined();
    expect(result.transfer_count).toBeDefined();
  });

  it("returns correct years from both tables", async () => {
    const result = await getSummary(client);

    // Seeded: transactions have 2026 (4x) and 2025 (2x), transfers have 2026 (3x) and 2025 (1x)
    expect(result.years).toContain(2025);
    expect(result.years).toContain(2026);
    expect(result.years.length).toBe(2);
  });

  it("returns correct accounts from both tables", async () => {
    const result = await getSummary(client);

    // Transactions: 招商银行 (5x), 支付宝 (1x)
    // Transfers: 招商银行 (2x), 汇丰银行 (1x), 支付宝 (1x)
    expect(result.accounts).toContain("招商银行");
    expect(result.accounts).toContain("支付宝");
    expect(result.accounts).toContain("汇丰银行");
    expect(result.accounts.length).toBe(3);
  });

  it("returns correct categories from transactions", async () => {
    const result = await getSummary(client);

    // Seeded: 餐饮, 交通, 工资, 投资
    expect(result.categories).toContain("餐饮");
    expect(result.categories).toContain("交通");
    expect(result.categories).toContain("工资");
    expect(result.categories).toContain("投资");
    expect(result.categories.length).toBe(4);
  });

  it("returns correct secondary_categories from transactions", async () => {
    const result = await getSummary(client);

    // Seeded: 早餐, 外卖, 出租车, 月薪, 股票, 奖金
    expect(result.secondary_categories).toContain("早餐");
    expect(result.secondary_categories).toContain("外卖");
    expect(result.secondary_categories).toContain("出租车");
    expect(result.secondary_categories).toContain("月薪");
    expect(result.secondary_categories).toContain("股票");
    expect(result.secondary_categories).toContain("奖金");
    expect(result.secondary_categories.length).toBe(6);
  });

  it("returns correct tertiary_categories from transactions", async () => {
    const result = await getSummary(client);

    // Seeded: 豆浆, 午餐, 市内, 基本工资, 分红, 年终
    expect(result.tertiary_categories).toContain("豆浆");
    expect(result.tertiary_categories).toContain("午餐");
    expect(result.tertiary_categories).toContain("市内");
    expect(result.tertiary_categories).toContain("基本工资");
    expect(result.tertiary_categories).toContain("分红");
    expect(result.tertiary_categories).toContain("年终");
    expect(result.tertiary_categories.length).toBe(6);
  });

  it("returns correct currencies from both tables", async () => {
    const result = await getSummary(client);

    // Transactions: 人民币 (4x), 美元 (1x)
    // Transfers: 人民币 (3x), 港币 (1x)
    expect(result.currencies).toContain("人民币");
    expect(result.currencies).toContain("美元");
    expect(result.currencies).toContain("港币");
    expect(result.currencies.length).toBe(3);
  });

  it("returns correct tags from both tables", async () => {
    const result = await getSummary(client);

    // Transactions seed: makeTransaction default tags=["日常"], 工作餐 tag on 午餐外卖
    // Transfers seed: ["日常"] on 日常转账
    expect(result.tags).toContain("日常");
    expect(result.tags).toContain("工作餐");
  });

  it("returns correct counts", async () => {
    const result = await getSummary(client);

    expect(result.transaction_count).toBe(6);
    expect(result.transfer_count).toBe(4);
  });
});
