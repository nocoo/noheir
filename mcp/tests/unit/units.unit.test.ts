/**
 * Unit Tests: Unit CRUD handlers
 *
 * Tests handler functions with mocked Supabase client.
 * Verifies parameter mapping, error handling, and result shaping
 * without any database dependency.
 */

import { describe, it, expect } from "bun:test";
import {
  listUnits,
  getUnit,
  createUnit,
  updateUnit,
  deleteUnit,
} from "../../src/tools/units";

// ============================================================================
// Mock helpers
// ============================================================================

function createChainMock(result: { data?: unknown; error?: unknown }) {
  const terminal = {
    data: result.data ?? null,
    error: result.error ?? null,
    then: function (resolve: any) {
      return Promise.resolve().then(() =>
        resolve({ data: this.data, error: this.error })
      );
    },
  };

  const chain: Record<string, any> = {};
  const methods = ["select", "eq", "order", "insert", "update", "delete", "single", "maybeSingle"];
  for (const m of methods) {
    chain[m] = function () { return chain; };
  }
  chain.then = terminal.then.bind(terminal);
  Object.defineProperty(chain, "data", { get: () => terminal.data });
  Object.defineProperty(chain, "error", { get: () => terminal.error });

  return {
    from: () => chain,
    rpc: () => ({
      data: result.data ?? null,
      error: result.error ?? null,
      then: function (resolve: any) {
        return Promise.resolve().then(() =>
          resolve({ data: result.data ?? null, error: result.error ?? null })
        );
      },
    }),
  } as any;
}

function createTrackingMock(result: { data?: unknown; error?: unknown }) {
  let eqCalls: [string, unknown][] = [];
  let insertedData: Record<string, unknown> = {};
  let updatedData: Record<string, unknown> = {};

  const chain: Record<string, any> = {};
  const methods = ["select", "order", "single", "maybeSingle", "delete"];
  for (const m of methods) {
    chain[m] = function () { return chain; };
  }
  chain.eq = function (col: string, val: unknown) {
    eqCalls.push([col, val]);
    return chain;
  };
  chain.insert = function (data: Record<string, unknown>) {
    insertedData = data;
    return chain;
  };
  chain.update = function (data: Record<string, unknown>) {
    updatedData = data;
    return chain;
  };
  chain.then = function (resolve: any) {
    return Promise.resolve().then(() => resolve({ data: result.data ?? null, error: result.error ?? null }));
  };

  const client = {
    from: () => chain,
    rpc: () => ({
      then: function (resolve: any) {
        return Promise.resolve().then(() => resolve({ data: result.data ?? null, error: result.error ?? null }));
      },
    }),
  } as any;

  return { client, getEqCalls: () => eqCalls, getInsertedData: () => insertedData, getUpdatedData: () => updatedData };
}

const SAMPLE_UNIT = {
  id: "11111111-2222-3333-4444-555555555555",
  unit_code: "E01",
  amount: 50000,
  currency: "CNY",
  status: "已成立",
  strategy: "短期理财",
  tactics: "债券基金",
  product_id: null,
  start_date: "2026-01-01",
  end_date: null,
  note: null,
  created_at: "2026-01-01T00:00:00Z",
};

const SAMPLE_UNIT_WITH_PRODUCT = {
  ...SAMPLE_UNIT,
  product_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  product: {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    name: "测试基金",
    code: "TEST001",
    channel: "招商银行",
    category: "债券基金",
    currency: "CNY",
    lock_period_days: 30,
    annual_return_rate: 3.5,
    created_at: "2026-01-01T00:00:00Z",
  },
};

// ============================================================================
// listUnits
// ============================================================================

describe("listUnits", () => {
  it("returns units from table query (without products)", async () => {
    const client = createChainMock({ data: [SAMPLE_UNIT] });
    const result = await listUnits(client, {});

    expect(result.units).toEqual([SAMPLE_UNIT]);
    expect(result.total_returned).toBe(1);
  });

  it("returns units with products from RPC", async () => {
    const client = createChainMock({ data: [SAMPLE_UNIT_WITH_PRODUCT] });
    const result = await listUnits(client, { with_products: true });

    expect(result.units).toEqual([SAMPLE_UNIT_WITH_PRODUCT]);
    expect(result.total_returned).toBe(1);
  });

  it("returns empty array when no units", async () => {
    const client = createChainMock({ data: [] });
    const result = await listUnits(client, {});

    expect(result.units).toEqual([]);
    expect(result.total_returned).toBe(0);
  });

  it("returns empty when data is null", async () => {
    const client = createChainMock({ data: null });
    const result = await listUnits(client, {});

    expect(result.units).toEqual([]);
    expect(result.total_returned).toBe(0);
  });

  it("throws on Supabase error (table query)", async () => {
    const client = createChainMock({ error: { message: "connection error" } });
    await expect(listUnits(client, {})).rejects.toThrow("list capital_units failed");
  });

  it("throws on Supabase error (RPC)", async () => {
    const client = createChainMock({ error: { message: "rpc error" } });
    await expect(listUnits(client, { with_products: true })).rejects.toThrow("get_units_with_products RPC failed");
  });

  it("passes status filter for table query", async () => {
    const { client, getEqCalls } = createTrackingMock({ data: [] });
    await listUnits(client, { status: "已成立" });

    expect(getEqCalls()).toContainEqual(["status", "已成立"]);
  });

  it("passes strategy filter for table query", async () => {
    const { client, getEqCalls } = createTrackingMock({ data: [] });
    await listUnits(client, { strategy: "短期理财" });

    expect(getEqCalls()).toContainEqual(["strategy", "短期理财"]);
  });

  it("passes tactics filter for table query", async () => {
    const { client, getEqCalls } = createTrackingMock({ data: [] });
    await listUnits(client, { tactics: "债券基金" });

    expect(getEqCalls()).toContainEqual(["tactics", "债券基金"]);
  });

  it("passes currency filter for table query", async () => {
    const { client, getEqCalls } = createTrackingMock({ data: [] });
    await listUnits(client, { currency: "USD" });

    expect(getEqCalls()).toContainEqual(["currency", "USD"]);
  });

  it("applies client-side status filter on RPC results", async () => {
    const units = [
      { ...SAMPLE_UNIT_WITH_PRODUCT, status: "已成立" },
      { ...SAMPLE_UNIT_WITH_PRODUCT, id: "other", status: "已归档" },
    ];
    const client = createChainMock({ data: units });
    const result = await listUnits(client, { with_products: true, status: "已归档" });

    expect(result.total_returned).toBe(1);
    expect(result.units[0].status).toBe("已归档");
  });

  it("applies client-side strategy filter on RPC results", async () => {
    const units = [
      { ...SAMPLE_UNIT_WITH_PRODUCT, strategy: "短期理财" },
      { ...SAMPLE_UNIT_WITH_PRODUCT, id: "other", strategy: "长期理财" },
    ];
    const client = createChainMock({ data: units });
    const result = await listUnits(client, { with_products: true, strategy: "长期理财" });

    expect(result.total_returned).toBe(1);
    expect(result.units[0].strategy).toBe("长期理财");
  });

  it("does not add eq filters when params are empty", async () => {
    const { client, getEqCalls } = createTrackingMock({ data: [] });
    await listUnits(client, {});

    expect(getEqCalls().length).toBe(0);
  });
});

// ============================================================================
// getUnit
// ============================================================================

describe("getUnit", () => {
  it("returns unit by id (without product)", async () => {
    const client = createChainMock({ data: SAMPLE_UNIT });
    const result = await getUnit(client, { id: SAMPLE_UNIT.id });

    expect(result.unit).toEqual(SAMPLE_UNIT);
  });

  it("returns unit with product from RPC", async () => {
    const client = createChainMock({ data: [SAMPLE_UNIT_WITH_PRODUCT] });
    const result = await getUnit(client, { id: SAMPLE_UNIT.id, with_product: true });

    expect(result.unit).toEqual(SAMPLE_UNIT_WITH_PRODUCT);
  });

  it("returns null when unit not found (table)", async () => {
    const client = createChainMock({ data: null });
    const result = await getUnit(client, { id: "nonexistent" });

    expect(result.unit).toBeNull();
  });

  it("returns null when unit not found (RPC)", async () => {
    const client = createChainMock({ data: [] });
    const result = await getUnit(client, { id: "nonexistent", with_product: true });

    expect(result.unit).toBeNull();
  });

  it("throws on Supabase error (table)", async () => {
    const client = createChainMock({ error: { message: "not found" } });
    await expect(getUnit(client, { id: "x" })).rejects.toThrow("get capital_unit failed");
  });

  it("throws on Supabase error (RPC)", async () => {
    const client = createChainMock({ error: { message: "rpc error" } });
    await expect(getUnit(client, { id: "x", with_product: true })).rejects.toThrow("get_units_with_products RPC failed");
  });
});

// ============================================================================
// createUnit
// ============================================================================

describe("createUnit", () => {
  it("returns created unit", async () => {
    const client = createChainMock({ data: SAMPLE_UNIT });
    const result = await createUnit(client, {
      unit_code: "E01",
      amount: 50000,
      strategy: "短期理财",
      tactics: "债券基金",
    });

    expect(result.unit).toEqual(SAMPLE_UNIT);
  });

  it("throws on Supabase error", async () => {
    const client = createChainMock({ error: { message: "check constraint" } });
    await expect(
      createUnit(client, {
        unit_code: "X",
        amount: 100,
        strategy: "invalid",
        tactics: "invalid",
      })
    ).rejects.toThrow("create capital_unit failed");
  });

  it("passes all optional fields to insert", async () => {
    const { client, getInsertedData } = createTrackingMock({ data: SAMPLE_UNIT });
    await createUnit(client, {
      unit_code: "E01",
      amount: 50000,
      strategy: "短期理财",
      tactics: "债券基金",
      currency: "USD",
      status: "计划中",
      product_id: "some-uuid",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      note: "test note",
    });

    const data = getInsertedData();
    expect(data.unit_code).toBe("E01");
    expect(data.currency).toBe("USD");
    expect(data.status).toBe("计划中");
    expect(data.product_id).toBe("some-uuid");
    expect(data.note).toBe("test note");
  });

  it("omits undefined optional fields from insert", async () => {
    const { client, getInsertedData } = createTrackingMock({ data: SAMPLE_UNIT });
    await createUnit(client, {
      unit_code: "E01",
      amount: 50000,
      strategy: "短期理财",
      tactics: "债券基金",
    });

    const data = getInsertedData();
    expect(data).toEqual({
      unit_code: "E01",
      amount: 50000,
      strategy: "短期理财",
      tactics: "债券基金",
    });
    expect("currency" in data).toBe(false);
    expect("product_id" in data).toBe(false);
  });
});

// ============================================================================
// updateUnit
// ============================================================================

describe("updateUnit", () => {
  it("returns updated unit", async () => {
    const updated = { ...SAMPLE_UNIT, amount: 60000 };
    const client = createChainMock({ data: updated });
    const result = await updateUnit(client, {
      id: SAMPLE_UNIT.id,
      amount: 60000,
    });

    expect(result.unit.amount).toBe(60000);
  });

  it("throws when no fields to update", async () => {
    const client = createChainMock({ data: null });
    await expect(
      updateUnit(client, { id: SAMPLE_UNIT.id })
    ).rejects.toThrow("no fields to update");
  });

  it("throws on Supabase error", async () => {
    const client = createChainMock({ error: { message: "row not found" } });
    await expect(
      updateUnit(client, { id: "x", amount: 100 })
    ).rejects.toThrow("update capital_unit failed");
  });

  it("includes nullable fields (null values) in update payload", async () => {
    const { client, getUpdatedData } = createTrackingMock({ data: SAMPLE_UNIT });
    await updateUnit(client, {
      id: SAMPLE_UNIT.id,
      product_id: null,
      start_date: null,
      note: null,
    });

    const data = getUpdatedData();
    expect(data.product_id).toBeNull();
    expect(data.start_date).toBeNull();
    expect(data.note).toBeNull();
  });

  it("only includes provided fields", async () => {
    const { client, getUpdatedData } = createTrackingMock({ data: SAMPLE_UNIT });
    await updateUnit(client, {
      id: SAMPLE_UNIT.id,
      status: "已归档",
    });

    const data = getUpdatedData();
    expect(data).toEqual({ status: "已归档" });
    expect("amount" in data).toBe(false);
    expect("strategy" in data).toBe(false);
  });
});

// ============================================================================
// deleteUnit
// ============================================================================

describe("deleteUnit", () => {
  it("returns success on delete", async () => {
    const client = createChainMock({ data: null, error: null });
    const result = await deleteUnit(client, { id: SAMPLE_UNIT.id });

    expect(result.success).toBe(true);
  });

  it("throws on Supabase error", async () => {
    const client = createChainMock({ error: { message: "permission denied" } });
    await expect(
      deleteUnit(client, { id: "x" })
    ).rejects.toThrow("delete capital_unit failed");
  });
});
