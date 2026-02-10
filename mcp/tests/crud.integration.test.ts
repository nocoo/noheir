/**
 * Integration Tests: Product & Unit CRUD handlers
 *
 * Tests handler functions with a real Supabase client against local Supabase.
 * Validates full CRUD lifecycle, filters, FK constraints, and edge cases.
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { createAuthenticatedClient } from "../../tests/e2e/helpers/supabase-client";
import { cleanupUser } from "../../tests/e2e/helpers/cleanup";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../src/tools/products";
import {
  listUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
} from "../src/tools/units";

/* eslint-disable @typescript-eslint/no-explicit-any -- root and mcp have separate @supabase/supabase-js instances */
let client: any;
let user: any;

beforeAll(async () => {
  const auth = await createAuthenticatedClient("mcp-crud");
  client = auth.client;
  user = auth.user;
});

afterAll(async () => {
  if (user?.id) {
    await cleanupUser(user.id);
  }
});

// ============================================================================
// Product CRUD
// ============================================================================

describe("Product CRUD (Integration)", () => {
  let productId: string;

  // --------------------------------------------------------------------------
  // Create
  // --------------------------------------------------------------------------

  it("creates a product with required fields only", async () => {
    const result = await createProduct(client, {
      name: "集成测试基金A",
      channel: "招商银行",
      category: "债券基金",
    });

    expect(result.product).toBeDefined();
    expect(result.product.id).toBeDefined();
    expect(result.product.name).toBe("集成测试基金A");
    expect(result.product.channel).toBe("招商银行");
    expect(result.product.category).toBe("债券基金");
    expect(result.product.currency).toBe("CNY"); // default
    expect(result.product.lock_period_days).toBe(0); // default
    productId = result.product.id;
  });

  it("creates a product with all fields", async () => {
    const result = await createProduct(client, {
      name: "集成测试基金B",
      code: "INT002",
      channel: "支付宝",
      category: "货币基金",
      currency: "USD",
      lock_period_days: 90,
      annual_return_rate: 4.2,
    });

    expect(result.product.name).toBe("集成测试基金B");
    expect(result.product.code).toBe("INT002");
    expect(result.product.channel).toBe("支付宝");
    expect(result.product.category).toBe("货币基金");
    expect(result.product.currency).toBe("USD");
    expect(result.product.lock_period_days).toBe(90);
    expect(result.product.annual_return_rate).toBe(4.2);
  });

  it("creates a product with HKD currency", async () => {
    const result = await createProduct(client, {
      name: "港币产品",
      channel: "招银香港",
      category: "定期存款",
      currency: "HKD",
    });

    expect(result.product.currency).toBe("HKD");
  });

  // --------------------------------------------------------------------------
  // List
  // --------------------------------------------------------------------------

  it("lists all products", async () => {
    const result = await listProducts(client, {});

    expect(result.products.length).toBe(3);
    expect(result.total_returned).toBe(3);
  });

  it("filters products by channel", async () => {
    const result = await listProducts(client, { channel: "招商银行" });

    expect(result.products.length).toBe(1);
    expect(result.products[0].name).toBe("集成测试基金A");
  });

  it("filters products by category", async () => {
    const result = await listProducts(client, { category: "货币基金" });

    expect(result.products.length).toBe(1);
    expect(result.products[0].name).toBe("集成测试基金B");
  });

  it("filters products by currency", async () => {
    const result = await listProducts(client, { currency: "HKD" });

    expect(result.products.length).toBe(1);
    expect(result.products[0].name).toBe("港币产品");
  });

  it("returns empty when filter matches nothing", async () => {
    const result = await listProducts(client, { channel: "不存在的渠道" });

    expect(result.products).toEqual([]);
    expect(result.total_returned).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Get
  // --------------------------------------------------------------------------

  it("gets a product by id", async () => {
    const result = await getProduct(client, { id: productId });

    expect(result.product).toBeDefined();
    expect(result.product!.id).toBe(productId);
    expect(result.product!.name).toBe("集成测试基金A");
  });

  it("returns null for nonexistent product", async () => {
    const result = await getProduct(client, { id: "00000000-0000-0000-0000-000000000000" });

    expect(result.product).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Update
  // --------------------------------------------------------------------------

  it("updates product name", async () => {
    const result = await updateProduct(client, {
      id: productId,
      name: "更新后的基金名",
    });

    expect(result.product.name).toBe("更新后的基金名");
    expect(result.product.channel).toBe("招商银行"); // unchanged
  });

  it("updates multiple product fields", async () => {
    const result = await updateProduct(client, {
      id: productId,
      lock_period_days: 180,
      annual_return_rate: 5.0,
    });

    expect(result.product.lock_period_days).toBe(180);
    expect(result.product.annual_return_rate).toBe(5.0);
  });

  it("rejects update with no fields", async () => {
    await expect(
      updateProduct(client, { id: productId })
    ).rejects.toThrow("no fields to update");
  });

  // --------------------------------------------------------------------------
  // Delete
  // --------------------------------------------------------------------------

  it("deletes a product", async () => {
    // Create a disposable product
    const created = await createProduct(client, {
      name: "待删除产品",
      channel: "微众银行",
      category: "理财产品",
    });

    const result = await deleteProduct(client, { id: created.product.id });
    expect(result.success).toBe(true);

    // Verify it's gone
    const fetched = await getProduct(client, { id: created.product.id });
    expect(fetched.product).toBeNull();
  });
});

// ============================================================================
// Unit CRUD
// ============================================================================

describe("Unit CRUD (Integration)", () => {
  let unitId: string;
  let linkedProductId: string;

  // Need a product for linking tests
  beforeAll(async () => {
    const prod = await createProduct(client, {
      name: "关联产品",
      channel: "平安银行",
      category: "债券基金",
      lock_period_days: 30,
    });
    linkedProductId = prod.product.id;
  });

  // --------------------------------------------------------------------------
  // Create
  // --------------------------------------------------------------------------

  it("creates a unit with required fields only", async () => {
    const result = await createUnit(client, {
      unit_code: "INT-U001",
      amount: 50000,
      strategy: "短期理财",
      tactics: "债券基金",
    });

    expect(result.unit).toBeDefined();
    expect(result.unit.id).toBeDefined();
    expect(result.unit.unit_code).toBe("INT-U001");
    expect(result.unit.amount).toBe(50000);
    expect(result.unit.currency).toBe("CNY"); // default
    expect(result.unit.status).toBe("已成立"); // default
    unitId = result.unit.id;
  });

  it("creates a unit with all fields", async () => {
    const result = await createUnit(client, {
      unit_code: "INT-U002",
      amount: 100000,
      strategy: "长期理财",
      tactics: "定期存款",
      currency: "USD",
      status: "计划中",
      product_id: linkedProductId,
      start_date: "2026-02-01",
      end_date: "2026-08-01",
      note: "集成测试备注",
    });

    expect(result.unit.unit_code).toBe("INT-U002");
    expect(result.unit.currency).toBe("USD");
    expect(result.unit.status).toBe("计划中");
    expect(result.unit.product_id).toBe(linkedProductId);
    expect(result.unit.start_date).toBe("2026-02-01");
    expect(result.unit.note).toBe("集成测试备注");
  });

  it("creates a unit without optional fields", async () => {
    const result = await createUnit(client, {
      unit_code: "INT-U003",
      amount: 20000,
      strategy: "中期理财",
      tactics: "货币基金",
    });

    expect(result.unit.product_id).toBeNull();
    expect(result.unit.note).toBeNull();
  });

  // --------------------------------------------------------------------------
  // List
  // --------------------------------------------------------------------------

  it("lists all units (without products)", async () => {
    const result = await listUnits(client, {});

    expect(result.units.length).toBe(3);
    expect(result.total_returned).toBe(3);
  });

  it("lists units with products", async () => {
    const result = await listUnits(client, { with_products: true });

    expect(result.units.length).toBe(3);
    // The unit linked to a product should have product data
    const linked = result.units.find((u: any) => u.product_id === linkedProductId);
    expect(linked).toBeDefined();
    expect((linked as any).product).toBeDefined();
    expect((linked as any).product.name).toBe("关联产品");
  });

  it("filters units by status", async () => {
    const result = await listUnits(client, { status: "计划中" });

    expect(result.units.length).toBe(1);
    expect(result.units[0].unit_code).toBe("INT-U002");
  });

  it("filters units by strategy", async () => {
    const result = await listUnits(client, { strategy: "短期理财" });

    expect(result.units.length).toBe(1);
    expect(result.units[0].unit_code).toBe("INT-U001");
  });

  it("filters units by tactics", async () => {
    const result = await listUnits(client, { tactics: "货币基金" });

    expect(result.units.length).toBe(1);
    expect(result.units[0].unit_code).toBe("INT-U003");
  });

  it("filters units by currency", async () => {
    const result = await listUnits(client, { currency: "USD" });

    expect(result.units.length).toBe(1);
    expect(result.units[0].unit_code).toBe("INT-U002");
  });

  it("returns empty when filter matches nothing", async () => {
    const result = await listUnits(client, { status: "已归档" });

    expect(result.units).toEqual([]);
    expect(result.total_returned).toBe(0);
  });

  it("filters with_products by status", async () => {
    const result = await listUnits(client, { with_products: true, status: "计划中" });

    expect(result.units.length).toBe(1);
    expect(result.units[0].unit_code).toBe("INT-U002");
  });

  it("filters with_products by currency", async () => {
    const result = await listUnits(client, { with_products: true, currency: "CNY" });

    expect(result.units.length).toBe(2); // INT-U001, INT-U003
  });

  // --------------------------------------------------------------------------
  // Get
  // --------------------------------------------------------------------------

  it("gets a unit by id (without product)", async () => {
    const result = await getUnit(client, { id: unitId });

    expect(result.unit).toBeDefined();
    expect(result.unit!.id).toBe(unitId);
    expect(result.unit!.unit_code).toBe("INT-U001");
  });

  it("gets a unit by id (with product)", async () => {
    // Get the unit linked to a product
    const all = await listUnits(client, { status: "计划中" });
    const linkedUnitId = all.units[0].id;

    const result = await getUnit(client, { id: linkedUnitId, with_product: true });

    expect(result.unit).toBeDefined();
    expect((result.unit as any).product).toBeDefined();
    expect((result.unit as any).product.name).toBe("关联产品");
  });

  it("returns null for nonexistent unit", async () => {
    const result = await getUnit(client, { id: "00000000-0000-0000-0000-000000000000" });

    expect(result.unit).toBeNull();
  });

  it("returns null for nonexistent unit (with_product)", async () => {
    const result = await getUnit(client, { id: "00000000-0000-0000-0000-000000000000", with_product: true });

    expect(result.unit).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Update
  // --------------------------------------------------------------------------

  it("updates unit code", async () => {
    const result = await updateUnit(client, {
      id: unitId,
      unit_code: "INT-U001-UPDATED",
    });

    expect(result.unit.unit_code).toBe("INT-U001-UPDATED");
  });

  it("updates multiple fields", async () => {
    const result = await updateUnit(client, {
      id: unitId,
      amount: 60000,
      note: "updated note",
    });

    expect(result.unit.amount).toBe(60000);
    expect(result.unit.note).toBe("updated note");
  });

  it("links unit to product", async () => {
    const result = await updateUnit(client, {
      id: unitId,
      product_id: linkedProductId,
      start_date: "2026-03-01",
    });

    expect(result.unit.product_id).toBe(linkedProductId);
    expect(result.unit.start_date).toBe("2026-03-01");
  });

  it("unlinks unit from product (set null)", async () => {
    const result = await updateUnit(client, {
      id: unitId,
      product_id: null,
      start_date: null,
    });

    expect(result.unit.product_id).toBeNull();
    expect(result.unit.start_date).toBeNull();
  });

  it("updates unit status", async () => {
    const result = await updateUnit(client, {
      id: unitId,
      status: "已归档",
    });

    expect(result.unit.status).toBe("已归档");
  });

  it("rejects update with no fields", async () => {
    await expect(
      updateUnit(client, { id: unitId })
    ).rejects.toThrow("no fields to update");
  });

  // --------------------------------------------------------------------------
  // Delete
  // --------------------------------------------------------------------------

  it("deletes a unit", async () => {
    // Create a disposable unit
    const created = await createUnit(client, {
      unit_code: "DISPOSABLE",
      amount: 1000,
      strategy: "短期理财",
      tactics: "现金产品",
    });

    const result = await deleteUnit(client, { id: created.unit.id });
    expect(result.success).toBe(true);

    // Verify it's gone
    const fetched = await getUnit(client, { id: created.unit.id });
    expect(fetched.unit).toBeNull();
  });

  // --------------------------------------------------------------------------
  // FK constraints: deleting product sets unit.product_id to null
  // --------------------------------------------------------------------------

  it("deleting a linked product sets unit product_id to null", async () => {
    // Create product + linked unit
    const prod = await createProduct(client, {
      name: "FK测试产品",
      channel: "微众银行",
      category: "理财产品",
    });
    const unit = await createUnit(client, {
      unit_code: "FK-TEST",
      amount: 5000,
      strategy: "短期理财",
      tactics: "理财产品",
      product_id: prod.product.id,
    });

    expect(unit.unit.product_id).toBe(prod.product.id);

    // Delete the product
    await deleteProduct(client, { id: prod.product.id });

    // Unit should still exist but with product_id = null
    const fetched = await getUnit(client, { id: unit.unit.id });
    expect(fetched.unit).toBeDefined();
    expect(fetched.unit!.product_id).toBeNull();

    // Clean up
    await deleteUnit(client, { id: unit.unit.id });
  });
});
