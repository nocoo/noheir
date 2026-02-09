/**
 * E2E: RPC Functions (2 scenarios)
 *
 * 42. rpc('get_units_with_products') — returns units with joined product JSONB
 * 43. rpc('search_transactions_fuzzy') — keyword + filter search
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { createAuthenticatedClient } from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";
import { makeUnit, makeProduct, makeTransaction } from "./helpers/seed";
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
});
