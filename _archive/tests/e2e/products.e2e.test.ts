/**
 * E2E: Financial Products (5 scenarios)
 *
 * 24. select all
 * 25. select by id
 * 26. insert
 * 27. update
 * 28. delete
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { createAuthenticatedClient } from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";
import { makeProduct } from "./helpers/seed";
import type { SupabaseClient, User } from "@supabase/supabase-js";

let client: SupabaseClient;
let user: User;
let productId: string;

beforeAll(async () => {
  const auth = await createAuthenticatedClient("prod");
  client = auth.client;
  user = auth.user;
});

afterAll(async () => {
  if (user?.id) {
    await cleanupUser(user.id);
  }
});

describe("Financial Products E2E", () => {
  it("insert creates a product", async () => {
    const payload = makeProduct();

    const { data, error } = await client
      .from("financial_products")
      .insert(payload)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.name).toBe("E2E 测试基金");
    expect(data!.code).toBe("E2E001");
    expect(data!.channel).toBe("招商银行");
    expect(data!.category).toBe("债券基金");
    expect(data!.currency).toBe("CNY");
    expect(data!.annual_return_rate).toBe(3.5);
    expect(data!.user_id).toBe(user.id);

    productId = data!.id;
  });

  it("select all returns the inserted product", async () => {
    const { data, error } = await client
      .from("financial_products")
      .select("*");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
    expect(data!.some((p: { id: string }) => p.id === productId)).toBe(true);
  });

  it("select by id returns the specific product", async () => {
    const { data, error } = await client
      .from("financial_products")
      .select("*")
      .eq("id", productId)
      .single();

    expect(error).toBeNull();
    expect(data!.id).toBe(productId);
    expect(data!.name).toBe("E2E 测试基金");
  });

  it("update modifies the product", async () => {
    const { data, error } = await client
      .from("financial_products")
      .update({ name: "Updated 基金", annual_return_rate: 5.0 })
      .eq("id", productId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.name).toBe("Updated 基金");
    expect(data!.annual_return_rate).toBe(5.0);
    // Unchanged fields preserved
    expect(data!.channel).toBe("招商银行");
  });

  it("delete removes the product", async () => {
    const { error } = await client
      .from("financial_products")
      .delete()
      .eq("id", productId);

    expect(error).toBeNull();

    // Verify deletion
    const { data } = await client
      .from("financial_products")
      .select("*")
      .eq("id", productId);

    expect(data).toEqual([]);
  });
});
