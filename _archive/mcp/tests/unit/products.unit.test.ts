/* eslint-disable @typescript-eslint/no-explicit-any -- mock chains require dynamic typing */

/**
 * Unit Tests: Product CRUD handlers
 *
 * Tests handler functions with mocked Supabase client.
 * Verifies parameter mapping, error handling, and result shaping
 * without any database dependency.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../../src/tools/products";

// ============================================================================
// Mock helpers
// ============================================================================

function createMockClient(overrides: Record<string, unknown> = {}) {
  const mockQuery = {
    select: function () { return this; },
    eq: function () { return this; },
    order: function () { return this; },
    insert: function () { return this; },
    update: function () { return this; },
    delete: function () { return this; },
    single: function () { return this; },
    maybeSingle: function () { return this; },
    data: overrides.data ?? null,
    error: overrides.error ?? null,
    then: function (resolve: (value: { data: unknown; error: unknown }) => void) {
      return Promise.resolve().then(() =>
        resolve({ data: this.data, error: this.error })
      );
    },
  };

  return {
    from: () => mockQuery,
    _mockQuery: mockQuery,
  } as any;
}

// Build a chainable mock where the final method returns { data, error }
function createChainMock(result: { data?: unknown; error?: unknown }) {
  const terminal = {
    data: result.data ?? null,
    error: result.error ?? null,
    then: function (resolve: (v: { data: unknown; error: unknown }) => void) {
      return Promise.resolve().then(() =>
        resolve({ data: this.data, error: this.error })
      );
    },
  };

  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "insert", "update", "delete", "single", "maybeSingle"];
  for (const m of methods) {
    chain[m] = function () { return chain; };
  }
  // Override terminal methods to actually resolve
  chain.then = terminal.then.bind(terminal);
  Object.defineProperty(chain, "data", { get: () => terminal.data });
  Object.defineProperty(chain, "error", { get: () => terminal.error });

  return {
    from: () => chain,
  } as any;
}

const SAMPLE_PRODUCT = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  name: "测试基金",
  code: "TEST001",
  channel: "招商银行",
  category: "债券基金",
  currency: "CNY",
  lock_period_days: 30,
  annual_return_rate: 3.5,
  created_at: "2026-01-01T00:00:00Z",
};

// ============================================================================
// listProducts
// ============================================================================

describe("listProducts", () => {
  it("returns products from Supabase", async () => {
    const client = createChainMock({ data: [SAMPLE_PRODUCT] });
    const result = await listProducts(client, {});

    expect(result.products).toEqual([SAMPLE_PRODUCT]);
    expect(result.total_returned).toBe(1);
  });

  it("returns empty array when no products", async () => {
    const client = createChainMock({ data: [] });
    const result = await listProducts(client, {});

    expect(result.products).toEqual([]);
    expect(result.total_returned).toBe(0);
  });

  it("returns empty array when data is null", async () => {
    const client = createChainMock({ data: null });
    const result = await listProducts(client, {});

    expect(result.products).toEqual([]);
    expect(result.total_returned).toBe(0);
  });

  it("throws on Supabase error", async () => {
    const client = createChainMock({
      error: { message: "connection refused" },
    });

    await expect(listProducts(client, {})).rejects.toThrow(
      "list financial_products failed: connection refused"
    );
  });

  it("passes channel filter", async () => {
    const eqCalls: [string, unknown][] = [];
    const chain: Record<string, any> = {};
    const methods = ["select", "order", "single", "maybeSingle", "insert", "update", "delete"];
    for (const m of methods) {
      chain[m] = function () { return chain; };
    }
    chain.eq = function (col: string, val: unknown) {
      eqCalls.push([col, val]);
      return chain;
    };
    chain.then = function (resolve: any) {
      return Promise.resolve().then(() => resolve({ data: [], error: null }));
    };

    const client = { from: () => chain } as any;
    await listProducts(client, { channel: "招商银行" });

    expect(eqCalls).toContainEqual(["channel", "招商银行"]);
  });

  it("passes category filter", async () => {
    const eqCalls: [string, unknown][] = [];
    const chain: Record<string, any> = {};
    const methods = ["select", "order", "single", "maybeSingle", "insert", "update", "delete"];
    for (const m of methods) {
      chain[m] = function () { return chain; };
    }
    chain.eq = function (col: string, val: unknown) {
      eqCalls.push([col, val]);
      return chain;
    };
    chain.then = function (resolve: any) {
      return Promise.resolve().then(() => resolve({ data: [], error: null }));
    };

    const client = { from: () => chain } as any;
    await listProducts(client, { category: "债券基金" });

    expect(eqCalls).toContainEqual(["category", "债券基金"]);
  });

  it("passes currency filter", async () => {
    const eqCalls: [string, unknown][] = [];
    const chain: Record<string, any> = {};
    const methods = ["select", "order", "single", "maybeSingle", "insert", "update", "delete"];
    for (const m of methods) {
      chain[m] = function () { return chain; };
    }
    chain.eq = function (col: string, val: unknown) {
      eqCalls.push([col, val]);
      return chain;
    };
    chain.then = function (resolve: any) {
      return Promise.resolve().then(() => resolve({ data: [], error: null }));
    };

    const client = { from: () => chain } as any;
    await listProducts(client, { currency: "USD" });

    expect(eqCalls).toContainEqual(["currency", "USD"]);
  });

  it("does not add eq filters when params are empty", async () => {
    const eqCalls: [string, unknown][] = [];
    const chain: Record<string, any> = {};
    const methods = ["select", "order", "single", "maybeSingle", "insert", "update", "delete"];
    for (const m of methods) {
      chain[m] = function () { return chain; };
    }
    chain.eq = function (col: string, val: unknown) {
      eqCalls.push([col, val]);
      return chain;
    };
    chain.then = function (resolve: any) {
      return Promise.resolve().then(() => resolve({ data: [], error: null }));
    };

    const client = { from: () => chain } as any;
    await listProducts(client, {});

    expect(eqCalls.length).toBe(0);
  });
});

// ============================================================================
// getProduct
// ============================================================================

describe("getProduct", () => {
  it("returns product by id", async () => {
    const client = createChainMock({ data: SAMPLE_PRODUCT });
    const result = await getProduct(client, { id: SAMPLE_PRODUCT.id });

    expect(result.product).toEqual(SAMPLE_PRODUCT);
  });

  it("returns null when product not found", async () => {
    const client = createChainMock({ data: null });
    const result = await getProduct(client, { id: "nonexistent" });

    expect(result.product).toBeNull();
  });

  it("throws on Supabase error", async () => {
    const client = createChainMock({
      error: { message: "not found" },
    });

    await expect(getProduct(client, { id: "x" })).rejects.toThrow(
      "get financial_product failed: not found"
    );
  });
});

// ============================================================================
// createProduct
// ============================================================================

describe("createProduct", () => {
  it("returns created product", async () => {
    const client = createChainMock({ data: SAMPLE_PRODUCT });
    const result = await createProduct(client, {
      name: "测试基金",
      channel: "招商银行",
      category: "债券基金",
    });

    expect(result.product).toEqual(SAMPLE_PRODUCT);
  });

  it("throws on Supabase error", async () => {
    const client = createChainMock({
      error: { message: "check constraint violated" },
    });

    await expect(
      createProduct(client, {
        name: "bad",
        channel: "invalid",
        category: "invalid",
      })
    ).rejects.toThrow("create financial_product failed: check constraint violated");
  });

  it("passes optional fields to insert", async () => {
    let insertedData: Record<string, unknown> = {};
    const chain: Record<string, any> = {};
    const methods = ["eq", "order", "maybeSingle", "update", "delete"];
    for (const m of methods) {
      chain[m] = function () { return chain; };
    }
    chain.select = function () { return chain; };
    chain.single = function () { return chain; };
    chain.insert = function (data: Record<string, unknown>) {
      insertedData = data;
      return chain;
    };
    chain.then = function (resolve: any) {
      return Promise.resolve().then(() => resolve({ data: SAMPLE_PRODUCT, error: null }));
    };

    const client = { from: () => chain } as any;
    await createProduct(client, {
      name: "测试",
      channel: "招商银行",
      category: "债券基金",
      code: "CODE1",
      currency: "USD",
      lock_period_days: 90,
      annual_return_rate: 4.2,
    });

    expect(insertedData.name).toBe("测试");
    expect(insertedData.code).toBe("CODE1");
    expect(insertedData.currency).toBe("USD");
    expect(insertedData.lock_period_days).toBe(90);
    expect(insertedData.annual_return_rate).toBe(4.2);
  });

  it("omits undefined optional fields from insert", async () => {
    let insertedData: Record<string, unknown> = {};
    const chain: Record<string, any> = {};
    const methods = ["eq", "order", "maybeSingle", "update", "delete"];
    for (const m of methods) {
      chain[m] = function () { return chain; };
    }
    chain.select = function () { return chain; };
    chain.single = function () { return chain; };
    chain.insert = function (data: Record<string, unknown>) {
      insertedData = data;
      return chain;
    };
    chain.then = function (resolve: any) {
      return Promise.resolve().then(() => resolve({ data: SAMPLE_PRODUCT, error: null }));
    };

    const client = { from: () => chain } as any;
    await createProduct(client, {
      name: "测试",
      channel: "招商银行",
      category: "债券基金",
    });

    expect(insertedData).toEqual({
      name: "测试",
      channel: "招商银行",
      category: "债券基金",
    });
    expect("code" in insertedData).toBe(false);
    expect("currency" in insertedData).toBe(false);
  });
});

// ============================================================================
// updateProduct
// ============================================================================

describe("updateProduct", () => {
  it("returns updated product", async () => {
    const updated = { ...SAMPLE_PRODUCT, name: "更新后的基金" };
    const client = createChainMock({ data: updated });
    const result = await updateProduct(client, {
      id: SAMPLE_PRODUCT.id,
      name: "更新后的基金",
    });

    expect(result.product.name).toBe("更新后的基金");
  });

  it("throws when no fields to update", async () => {
    const client = createChainMock({ data: null });

    await expect(
      updateProduct(client, { id: SAMPLE_PRODUCT.id })
    ).rejects.toThrow("no fields to update");
  });

  it("throws on Supabase error", async () => {
    const client = createChainMock({
      error: { message: "row not found" },
    });

    await expect(
      updateProduct(client, { id: "x", name: "new" })
    ).rejects.toThrow("update financial_product failed: row not found");
  });

  it("only includes provided fields in update payload", async () => {
    let updatedData: Record<string, unknown> = {};
    const chain: Record<string, any> = {};
    const methods = ["eq", "order", "maybeSingle", "insert", "delete", "select", "single"];
    for (const m of methods) {
      chain[m] = function () { return chain; };
    }
    chain.update = function (data: Record<string, unknown>) {
      updatedData = data;
      return chain;
    };
    chain.then = function (resolve: any) {
      return Promise.resolve().then(() => resolve({ data: SAMPLE_PRODUCT, error: null }));
    };

    const client = { from: () => chain } as any;
    await updateProduct(client, {
      id: SAMPLE_PRODUCT.id,
      name: "新名字",
      lock_period_days: 60,
    });

    expect(updatedData).toEqual({ name: "新名字", lock_period_days: 60 });
    expect("channel" in updatedData).toBe(false);
    expect("category" in updatedData).toBe(false);
  });
});

// ============================================================================
// deleteProduct
// ============================================================================

describe("deleteProduct", () => {
  it("returns success on delete", async () => {
    const client = createChainMock({ data: null, error: null });
    const result = await deleteProduct(client, { id: SAMPLE_PRODUCT.id });

    expect(result.success).toBe(true);
  });

  it("throws on Supabase error", async () => {
    const client = createChainMock({
      error: { message: "foreign key constraint" },
    });

    await expect(
      deleteProduct(client, { id: "x" })
    ).rejects.toThrow("delete financial_product failed: foreign key constraint");
  });
});
