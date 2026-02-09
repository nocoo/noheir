/**
 * E2E: Capital Units (13 scenarios)
 *
 * 29. select all (no product)
 * 30. select filtered + sorted
 * 31. select by id
 * 32. insert single
 * 33. update single
 * 34. delete single
 * 35. deploy: verify status + update product/dates
 * 36. recall: clear product + reset status
 * 37. archive: set status '已归档'
 * 38. insert batch
 * 39. update batch statuses
 * 40. select + join product by id
 * 41. select products by ids (for manual join)
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { createAuthenticatedClient } from "./helpers/supabase-client";
import { cleanupUser } from "./helpers/cleanup";
import { makeUnit, makeProduct } from "./helpers/seed";
import type { SupabaseClient, User } from "@supabase/supabase-js";

let client: SupabaseClient;
let user: User;
let unitId: string;
let productId: string;
let batchUnitIds: string[] = [];

beforeAll(async () => {
  const auth = await createAuthenticatedClient("units");
  client = auth.client;
  user = auth.user;

  // Create a product for deploy/recall tests
  const { data: prod } = await client
    .from("financial_products")
    .insert(makeProduct({ name: "Units 测试基金" }))
    .select()
    .single();
  productId = prod!.id;
});

afterAll(async () => {
  if (user?.id) {
    await cleanupUser(user.id);
  }
});

describe("Capital Units E2E", () => {
  // --- Basic CRUD ---

  it("insert single creates a unit", async () => {
    const payload = makeUnit({ unit_code: "U-SINGLE-001" });

    const { data, error } = await client
      .from("capital_units")
      .insert(payload)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.unit_code).toBe("U-SINGLE-001");
    expect(data!.amount).toBe(10000);
    expect(data!.status).toBe("已成立");
    expect(data!.strategy).toBe("短期理财");
    expect(data!.user_id).toBe(user.id);

    unitId = data!.id;
  });

  it("select all returns inserted unit (no product linked)", async () => {
    const { data, error } = await client
      .from("capital_units")
      .select("*");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);

    const unit = data!.find((u: { id: string }) => u.id === unitId);
    expect(unit).toBeDefined();
    expect(unit!.product_id).toBeNull();
  });

  it("select by id returns the specific unit", async () => {
    const { data, error } = await client
      .from("capital_units")
      .select("*")
      .eq("id", unitId)
      .single();

    expect(error).toBeNull();
    expect(data!.id).toBe(unitId);
    expect(data!.unit_code).toBe("U-SINGLE-001");
  });

  it("update single modifies the unit", async () => {
    const { data, error } = await client
      .from("capital_units")
      .update({ amount: 20000, note: "updated amount" })
      .eq("id", unitId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.amount).toBe(20000);
    expect(data!.note).toBe("updated amount");
  });

  // --- Filtered + Sorted ---

  it("select filtered by status + sorted by amount", async () => {
    // Insert another unit with different status for filtering
    await client.from("capital_units").insert(
      makeUnit({ unit_code: "U-PLAN-001", status: "计划中", amount: 5000 })
    );

    const { data, error } = await client
      .from("capital_units")
      .select("*")
      .eq("status", "已成立")
      .order("amount", { ascending: false });

    expect(error).toBeNull();
    expect(data!.every((u: { status: string }) => u.status === "已成立")).toBe(true);
    // Verify descending order
    for (let i = 1; i < data!.length; i++) {
      expect(Number(data![i - 1].amount) >= Number(data![i].amount)).toBe(true);
    }
  });

  // --- Deploy / Recall / Archive ---

  it("deploy: link product + update dates + verify status", async () => {
    const { data, error } = await client
      .from("capital_units")
      .update({
        product_id: productId,
        start_date: "2026-02-01",
        end_date: "2027-02-01",
        status: "已成立",
      })
      .eq("id", unitId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.product_id).toBe(productId);
    expect(data!.start_date).toBe("2026-02-01");
    expect(data!.end_date).toBe("2027-02-01");
    expect(data!.status).toBe("已成立");
  });

  it("select + join product by id (manual FK join)", async () => {
    // First get the unit
    const { data: unit } = await client
      .from("capital_units")
      .select("*")
      .eq("id", unitId)
      .single();

    expect(unit!.product_id).toBe(productId);

    // Then get the product
    const { data: product } = await client
      .from("financial_products")
      .select("*")
      .eq("id", unit!.product_id)
      .single();

    expect(product).toBeDefined();
    expect(product!.name).toBe("Units 测试基金");
  });

  it("select products by ids (batch lookup for manual join)", async () => {
    const { data, error } = await client
      .from("financial_products")
      .select("*")
      .in("id", [productId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(productId);
  });

  it("recall: clear product + reset status", async () => {
    const { data, error } = await client
      .from("capital_units")
      .update({
        product_id: null,
        end_date: null,
        status: "已成立",
      })
      .eq("id", unitId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.product_id).toBeNull();
    expect(data!.end_date).toBeNull();
  });

  it("archive: set status to 已归档", async () => {
    const { data, error } = await client
      .from("capital_units")
      .update({ status: "已归档" })
      .eq("id", unitId)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe("已归档");
  });

  // --- Batch operations ---

  it("insert batch creates multiple units", async () => {
    const batch = [
      makeUnit({ unit_code: "U-BATCH-001", amount: 1000 }),
      makeUnit({ unit_code: "U-BATCH-002", amount: 2000 }),
      makeUnit({ unit_code: "U-BATCH-003", amount: 3000, status: "计划中" }),
    ];

    const { data, error } = await client
      .from("capital_units")
      .insert(batch)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(3);

    batchUnitIds = data!.map((u: { id: string }) => u.id);
  });

  it("update batch statuses", async () => {
    // Update all batch units to 筹集中
    const { data, error } = await client
      .from("capital_units")
      .update({ status: "筹集中" })
      .in("id", batchUnitIds)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    expect(data!.every((u: { status: string }) => u.status === "筹集中")).toBe(true);
  });

  it("delete single removes the unit", async () => {
    const { error } = await client
      .from("capital_units")
      .delete()
      .eq("id", unitId);

    expect(error).toBeNull();

    const { data } = await client
      .from("capital_units")
      .select("*")
      .eq("id", unitId);

    expect(data).toEqual([]);
  });
});
