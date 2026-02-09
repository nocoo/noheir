/**
 * E2E: RPC Functions (2 scenarios)
 *
 * 42. rpc('get_units_with_products') — returns units with joined product JSONB
 * 43. rpc('search_transactions_fuzzy') — keyword + filter search
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { createAuthenticatedClient } from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";
import { makeUnit, makeProduct, makeTransaction, makeTransfer } from "./helpers/seed";
import type { SupabaseClient, User } from "@supabase/supabase-js";

let client: SupabaseClient;
let user: User;
let productId: string;

beforeAll(async () => {
  const auth = await createAuthenticatedClient("rpc");
  client = auth.client;
  user = auth.user;

  // Seed: create a product, a unit linked to it, and some transactions
  const { data: prod } = await client
    .from("financial_products")
    .insert(makeProduct({ name: "RPC 测试基金" }))
    .select()
    .single();
  productId = prod!.id;

  await client.from("capital_units").insert([
    makeUnit({ unit_code: "RPC-U-001", amount: 5000, product_id: productId }),
    makeUnit({ unit_code: "RPC-U-002", amount: 8000 }), // no product
  ]);

  await client.from("transactions").insert([
    makeTransaction({ note: "咖啡拿铁", primary_category: "餐饮", amount: 28 }),
    makeTransaction({ note: "地铁交通卡", primary_category: "交通", amount: 200 }),
    makeTransaction({ note: "午餐外卖", primary_category: "餐饮", amount: 35, type: "expense" }),
    makeTransaction({ note: "工资收入", primary_category: "工资", amount: 10000, type: "income" }),
    makeTransaction({ note: "美元消费", primary_category: "购物", amount: 50, currency: "美元", year: 2025, month: 6, day: 15, date: "2025-06-15" }),
  ]);

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

describe("RPC Functions E2E", () => {
  it("get_units_with_products returns units with embedded product JSON", async () => {
    const { data, error } = await client.rpc("get_units_with_products");

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBe(2);

    // Find the unit that has a product
    const withProduct = data!.find(
      (u: { unit_code: string }) => u.unit_code === "RPC-U-001"
    );
    expect(withProduct).toBeDefined();
    expect(withProduct!.product).toBeDefined();
    expect(withProduct!.product.name).toBe("RPC 测试基金");
    expect(withProduct!.product.category).toBe("债券基金");
    expect(withProduct!.amount).toBe(5000);

    // Find the unit without a product
    const withoutProduct = data!.find(
      (u: { unit_code: string }) => u.unit_code === "RPC-U-002"
    );
    expect(withoutProduct).toBeDefined();
    expect(withoutProduct!.product).toBeNull();
  });

  it("search_transactions_fuzzy returns filtered results with matched_field", async () => {
    // Search by keyword "咖啡"
    const { data: keywordResult, error: keywordError } = await client.rpc(
      "search_transactions_fuzzy",
      { p_keyword: "咖啡" }
    );

    expect(keywordError).toBeNull();
    expect(keywordResult!.length).toBe(1);
    expect(keywordResult![0].note).toBe("咖啡拿铁");
    expect(keywordResult![0].matched_field).toBe("note");

    // Search by category filter
    const { data: categoryResult, error: catError } = await client.rpc(
      "search_transactions_fuzzy",
      { p_categories: ["餐饮"] }
    );

    expect(catError).toBeNull();
    expect(categoryResult!.length).toBe(2); // 咖啡 + 午餐

    // Search by type filter
    const { data: incomeResult, error: typeError } = await client.rpc(
      "search_transactions_fuzzy",
      { p_type: "income" }
    );

    expect(typeError).toBeNull();
    expect(incomeResult!.length).toBe(1);
    expect(incomeResult![0].primary_category).toBe("工资");

    // Search with amount range
    const { data: amountResult, error: amtError } = await client.rpc(
      "search_transactions_fuzzy",
      { p_min_amount: 100, p_max_amount: 500 }
    );

    expect(amtError).toBeNull();
    expect(amountResult!.length).toBe(1); // 地铁交通卡 200
    expect(amountResult![0].note).toBe("地铁交通卡");

    // Search with limit + offset
    const { data: pagedResult, error: pageError } = await client.rpc(
      "search_transactions_fuzzy",
      { p_limit: 2, p_offset: 0 }
    );

    expect(pageError).toBeNull();
    expect(pagedResult!.length).toBe(2);
  });

  it("search_transactions_fuzzy supports year/month/currency filters", async () => {
    // Filter by year
    const { data: yearResult, error: yearError } = await client.rpc(
      "search_transactions_fuzzy",
      { p_year: 2025 }
    );

    expect(yearError).toBeNull();
    expect(yearResult!.length).toBe(1);
    expect(yearResult![0].note).toBe("美元消费");

    // Filter by currency
    const { data: currencyResult, error: currencyError } = await client.rpc(
      "search_transactions_fuzzy",
      { p_currency: "美元" }
    );

    expect(currencyError).toBeNull();
    expect(currencyResult!.length).toBe(1);
    expect(currencyResult![0].currency).toBe("美元");

    // Filter by year + month
    const { data: monthResult, error: monthError } = await client.rpc(
      "search_transactions_fuzzy",
      { p_year: 2026, p_month: 1 }
    );

    expect(monthError).toBeNull();
    // All 2026-01 transactions (咖啡, 地铁, 午餐, 工资 — all seeded with default 2026-01)
    expect(monthResult!.length).toBe(4);
  });

  it("search_transfers_fuzzy returns filtered results with matched_field", async () => {
    // No filters — return all
    const { data: allResult, error: allError } = await client.rpc(
      "search_transfers_fuzzy"
    );

    expect(allError).toBeNull();
    expect(allResult!.length).toBe(4);

    // Keyword search
    const { data: keywordResult, error: kwError } = await client.rpc(
      "search_transfers_fuzzy",
      { p_keyword: "信用卡" }
    );

    expect(kwError).toBeNull();
    expect(keywordResult!.length).toBe(1);
    expect(keywordResult![0].note).toBe("还信用卡");
    expect(keywordResult![0].matched_field).toBe("note");

    // Account filter
    const { data: acctResult, error: acctError } = await client.rpc(
      "search_transfers_fuzzy",
      { p_accounts: ["招商银行"] }
    );

    expect(acctError).toBeNull();
    expect(acctResult!.length).toBe(2); // 还信用卡 + 理财赎回

    // Transaction type filter
    const { data: typeResult, error: typeError } = await client.rpc(
      "search_transfers_fuzzy",
      { p_transaction_type: "转入" }
    );

    expect(typeError).toBeNull();
    expect(typeResult!.length).toBe(1);
    expect(typeResult![0].note).toBe("理财赎回");

    // Amount range — matches GREATEST(inflow, outflow)
    const { data: amtResult, error: amtError } = await client.rpc(
      "search_transfers_fuzzy",
      { p_min_amount: 6000, p_max_amount: 15000 }
    );

    expect(amtError).toBeNull();
    expect(amtResult!.length).toBe(2); // 理财赎回 10000 + 港币兑换 8000

    // Pagination
    const { data: pagedResult, error: pageError } = await client.rpc(
      "search_transfers_fuzzy",
      { p_limit: 2, p_offset: 0 }
    );

    expect(pageError).toBeNull();
    expect(pagedResult!.length).toBe(2);
  });

  it("search_transfers_fuzzy supports year/month/currency/tags filters", async () => {
    // Year filter
    const { data: yearResult, error: yearError } = await client.rpc(
      "search_transfers_fuzzy",
      { p_year: 2025 }
    );

    expect(yearError).toBeNull();
    expect(yearResult!.length).toBe(1);
    expect(yearResult![0].note).toBe("港币兑换");

    // Currency filter
    const { data: currencyResult, error: currencyError } = await client.rpc(
      "search_transfers_fuzzy",
      { p_currency: "港币" }
    );

    expect(currencyError).toBeNull();
    expect(currencyResult!.length).toBe(1);
    expect(currencyResult![0].account).toBe("汇丰银行");

    // Tags filter
    const { data: tagsResult, error: tagsError } = await client.rpc(
      "search_transfers_fuzzy",
      { p_tags: ["日常"] }
    );

    expect(tagsError).toBeNull();
    expect(tagsResult!.length).toBe(1);
    expect(tagsResult![0].note).toBe("日常转账");

    // Date range
    const { data: dateResult, error: dateError } = await client.rpc(
      "search_transfers_fuzzy",
      { p_start_date: "2026-01-01", p_end_date: "2026-12-31" }
    );

    expect(dateError).toBeNull();
    // 3 transfers in 2026 (还信用卡, 理财赎回, 日常转账)
    expect(dateResult!.length).toBe(3);
  });
});
