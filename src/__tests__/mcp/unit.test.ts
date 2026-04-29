/**
 * Tests for MCP unit tools (registerUnitTools)
 *
 * Tests list_units, get_unit, create_unit, and update_unit via mock McpServer.
 */

import { describe, it, expect } from "bun:test";
import type { Db, DbMeta, DbQueryResult } from "@/lib/db";
import { registerUnitTools, type UnitWithProduct } from "@/lib/mcp/tools/unit";

/** Safe array access for test assertions */
function at<T>(arr: T[] | readonly T[], i: number): T {
  const item = arr[i];
  if (item === undefined) throw new Error(`Expected item at index ${i}`);
  return item;
}

// ---------------------------------------------------------------------------
// Mock Db
// ---------------------------------------------------------------------------

interface MockCall {
  sql: string;
  params: unknown[];
}

function createSequentialMockDb(responses: Array<{ type: "query"; results: unknown[] } | { type: "firstOrNull"; result: unknown } | { type: "execute"; changes?: number }>) {
  const calls: MockCall[] = [];
  let idx = 0;

  const db: Db = {
    async query<T>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>> {
      calls.push({ sql, params: params ?? [] });
      const resp = responses[idx++];
      const results = resp?.type === "query" ? resp.results : [];
      return { results: results as T[], meta: { changes: 0, duration: 1 } };
    },
    async firstOrNull<T>(sql: string, params?: unknown[]): Promise<T | null> {
      calls.push({ sql, params: params ?? [] });
      const resp = responses[idx++];
      return (resp?.type === "firstOrNull" ? resp.result : null) as T | null;
    },
    async execute(sql: string, params?: unknown[]): Promise<DbMeta> {
      calls.push({ sql, params: params ?? [] });
      const resp = responses[idx++];
      return { changes: resp?.type === "execute" ? (resp.changes ?? 1) : 1, duration: 1 };
    },
    async batch() { return []; },
  };

  return { db, calls };
}

// ---------------------------------------------------------------------------
// Mock McpServer
// ---------------------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

function createMockServer() {
  const tools = new Map<string, ToolHandler>();
  const server = {
    tool(name: string, _desc: string, _schema: unknown, handler: ToolHandler) {
      tools.set(name, handler);
    },
  };
  return { server: server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer, tools };
}

function getTool(tools: Map<string, ToolHandler>, name: string): ToolHandler {
  const handler = tools.get(name);
  if (!handler) throw new Error(`Tool ${name} not registered`);
  return handler;
}

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
  return JSON.parse(at(result.content, 0).text);
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const userId = "user-123";

const fakeUnit: UnitWithProduct = {
  id: "01UNITABCDEFGHIJKLMNOPQRS",
  unit_code: "C01",
  amount_cents: 1000000,
  currency: "CNY",
  status: "已成立",
  strategy: "远期理财",
  tactics: "定期存款",
  product_id: "01PRODUCT123456789012345",
  start_date: "2024-01-15",
  end_date: null,
  note: "Test unit",
  created_at: "2024-01-15T00:00:00Z",
  updated_at: "2024-01-15T00:00:00Z",
  product_name: "Test Product",
  product_lock_period_days: 30,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerUnitTools", () => {
  it("should register all 4 tools", () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([]);
    registerUnitTools(server, { db, userId });

    expect(tools.has("list_units")).toBe(true);
    expect(tools.has("get_unit")).toBe(true);
    expect(tools.has("create_unit")).toBe(true);
    expect(tools.has("update_unit")).toBe(true);
  });
});

describe("list_units", () => {
  it("should return empty list when no units", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "query", results: [] },  // units query
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "list_units")({});
    const data = parseResult(result);
    expect(data.units).toEqual([]);
    expect(data.page.returned).toBe(0);
  });

  it("should return enriched units with availability", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "query", results: [fakeUnit] },  // units query
      { type: "query", results: [] },           // contribution logs query
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "list_units")({});
    const data = parseResult(result);

    expect(data.units).toHaveLength(1);
    expect(data.units[0].code).toBe("C01");
    expect(data.units[0].amount).toBe(10000);
  });

  it("should apply status filter", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "query", results: [] },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "list_units")({ status: "已成立" });
    expect(at(calls, 0).sql).toContain("u.status = ?");
    expect(at(calls, 0).params).toContain("已成立");
  });

  it("should apply strategy filter", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "query", results: [] },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "list_units")({ strategy: "远期理财" });
    expect(at(calls, 0).sql).toContain("u.strategy = ?");
  });

  it("should apply tactics filter", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "query", results: [] },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "list_units")({ tactics: "定期存款" });
    expect(at(calls, 0).sql).toContain("u.tactics = ?");
  });

  it("should apply currency filter", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "query", results: [] },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "list_units")({ currency: "USD" });
    expect(at(calls, 0).sql).toContain("u.currency = ?");
  });

  it("should respect limit and offset", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "query", results: [] },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "list_units")({ limit: 10, offset: 20 });
    const params = at(calls, 0).params;
    expect(params[params.length - 2]).toBe(10);
    expect(params[params.length - 1]).toBe(20);
  });

  it("should cap limit at 200", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "query", results: [] },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "list_units")({ limit: 999 });
    const params = at(calls, 0).params;
    expect(params[params.length - 2]).toBe(200);
  });
});

describe("get_unit", () => {
  it("should find unit by full ID", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "query", results: [fakeUnit] },      // unit query
      { type: "firstOrNull", result: null },        // invest log
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "get_unit")({ id: fakeUnit.id });
    const data = parseResult(result);

    expect(data.id).toBe(fakeUnit.id); // Full ID returned
    expect(at(calls, 0).sql).toContain("u.id = ?");
  });

  it("should find unit by short ID (prefix match)", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "query", results: [fakeUnit] },
      { type: "firstOrNull", result: null },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "get_unit")({ id: "01UNITAB" });
    expect(at(calls, 0).sql).toContain("u.id LIKE ?");
    expect(at(calls, 0).params[0]).toBe("01UNITAB%");
  });

  it("should find unit by unit_code", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "query", results: [fakeUnit] },
      { type: "firstOrNull", result: null },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "get_unit")({ id: "C01" });
    expect(at(calls, 0).sql).toContain("UPPER(u.unit_code) = UPPER(?)");
  });

  it("should return error when not found", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "query", results: [] },
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "get_unit")({ id: "NOTFOUND" });
    const data = parseResult(result);
    expect(data.error).toContain("Unit not found");
    expect(result.isError).toBe(true);
  });

  it("should return error for ambiguous short ID", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "query", results: [fakeUnit, { ...fakeUnit, id: "01UNITAB-OTHER" }] },
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "get_unit")({ id: "01UNIT" });
    const data = parseResult(result);
    expect(data.error).toContain("Ambiguous");
    expect(result.isError).toBe(true);
  });
});

describe("create_unit", () => {
  it("should create a unit with required fields", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "execute", changes: 1 },  // INSERT
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "create_unit")({
      unit_code: "C10",
      amount_cents: 500000,
    });
    const data = parseResult(result);

    expect(data.unit_code).toBe("C10");
    expect(data.amount).toBe(5000);
    expect(data.currency).toBe("CNY"); // default
    expect(data.status).toBe("已成立"); // default
    expect(at(calls, 0).sql).toContain("INSERT INTO capital_units");
  });

  it("should validate product_id when provided", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "firstOrNull", result: null }, // product not found
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "create_unit")({
      unit_code: "C10",
      amount_cents: 500000,
      product_id: "nonexistent",
    });
    const data = parseResult(result);
    expect(data.error).toContain("Product not found");
    expect(result.isError).toBe(true);
  });

  it("should require end_date for 已归档 status", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "create_unit")({
      unit_code: "C10",
      amount_cents: 500000,
      status: "已归档",
    });
    const data = parseResult(result);
    expect(data.error).toContain("requires end_date");
  });

  it("should reject end_date for non-已归档 status", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "create_unit")({
      unit_code: "C10",
      amount_cents: 500000,
      status: "已成立",
      end_date: "2025-12-31",
    });
    const data = parseResult(result);
    expect(data.error).toContain("Only status '已归档' can have end_date");
  });

  it("should allow 已归档 with end_date", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "execute", changes: 1 },
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "create_unit")({
      unit_code: "C10",
      amount_cents: 500000,
      status: "已归档",
      end_date: "2025-12-31",
    });
    const data = parseResult(result);
    expect(data.status).toBe("已归档");
    expect(data.end_date).toBe("2025-12-31");
  });

  it("should pass optional fields", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "firstOrNull", result: { id: "prod-1" } }, // product found
      { type: "execute", changes: 1 },
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "create_unit")({
      unit_code: "A01",
      amount_cents: 100000,
      currency: "USD",
      strategy: "短期理财",
      tactics: "活期存款",
      product_id: "prod-1",
      start_date: "2025-01-01",
      note: "Test note",
    });
    const data = parseResult(result);

    expect(data.currency).toBe("USD");
    expect(data.strategy).toBe("短期理财");
    expect(data.note).toBe("Test note");
  });
});

describe("update_unit", () => {
  it("should return error when unit not found", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "firstOrNull", result: null }, // unit not found
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "update_unit")({ id: "nonexistent" });
    const data = parseResult(result);
    expect(data.error).toContain("Unit not found");
    expect(result.isError).toBe(true);
  });

  it("should return error when no fields to update", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "firstOrNull", result: { id: fakeUnit.id, status: "已成立", product_id: null, end_date: null } },
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "update_unit")({ id: fakeUnit.id });
    const data = parseResult(result);
    expect(data.error).toContain("No fields to update");
  });

  it("should validate product_id when provided", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "firstOrNull", result: { id: fakeUnit.id, status: "已成立", product_id: null, end_date: null } },
      { type: "firstOrNull", result: null }, // product not found
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "update_unit")({ id: fakeUnit.id, product_id: "bad-id" });
    const data = parseResult(result);
    expect(data.error).toContain("Product not found");
  });

  it("should enforce 已归档 requires end_date", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "firstOrNull", result: { id: fakeUnit.id, status: "已成立", product_id: null, end_date: null } },
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "update_unit")({ id: fakeUnit.id, status: "已归档" });
    const data = parseResult(result);
    expect(data.error).toContain("requires end_date");
  });

  it("should reject end_date for non-已归档", async () => {
    const { server, tools } = createMockServer();
    const { db } = createSequentialMockDb([
      { type: "firstOrNull", result: { id: fakeUnit.id, status: "已成立", product_id: null, end_date: null } },
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "update_unit")({ id: fakeUnit.id, end_date: "2025-12-31" });
    const data = parseResult(result);
    expect(data.error).toContain("Only status '已归档' can have end_date");
  });

  it("should update amount_cents successfully", async () => {
    const updatedUnit = { ...fakeUnit, amount_cents: 2000000 };
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "firstOrNull", result: { id: fakeUnit.id, status: "已成立", product_id: null, end_date: null } },
      { type: "execute", changes: 1 },                    // UPDATE
      { type: "firstOrNull", result: updatedUnit },        // fetch updated unit
      { type: "firstOrNull", result: null },               // invest log
    ]);
    registerUnitTools(server, { db, userId });

    const result = await getTool(tools, "update_unit")({ id: fakeUnit.id, amount_cents: 2000000 });
    parseResult(result); // ensure it doesn't error

    expect(at(calls, 1).sql).toContain("UPDATE capital_units SET");
    expect(at(calls, 1).sql).toContain("amount_cents = ?");
  });

  it("should update multiple fields", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "firstOrNull", result: { id: fakeUnit.id, status: "已成立", product_id: null, end_date: null } },
      { type: "execute", changes: 1 },
      { type: "firstOrNull", result: fakeUnit },
      { type: "firstOrNull", result: null },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "update_unit")({
      id: fakeUnit.id,
      unit_code: "C99",
      amount_cents: 999,
      currency: "USD",
      strategy: "新策略",
      tactics: "新战术",
      note: "Updated",
    });

    const updateSql = at(calls, 1).sql;
    expect(updateSql).toContain("unit_code = ?");
    expect(updateSql).toContain("amount_cents = ?");
    expect(updateSql).toContain("currency = ?");
    expect(updateSql).toContain("strategy = ?");
    expect(updateSql).toContain("tactics = ?");
    expect(updateSql).toContain("note = ?");
    expect(updateSql).toContain("updated_at = ?");
  });

  it("should log contribution when product_id changes from old to new", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "firstOrNull", result: { id: fakeUnit.id, status: "已成立", product_id: "old-prod", end_date: null } },
      { type: "firstOrNull", result: { id: "new-prod" } },  // validate new product
      { type: "execute", changes: 1 },                       // UPDATE
      // withdraw from old product
      { type: "firstOrNull", result: { name: "Old Product" } },  // get old product name
      { type: "execute", changes: 1 },                            // INSERT withdraw log
      // invest to new product
      { type: "firstOrNull", result: { name: "New Product" } },  // get new product name
      { type: "execute", changes: 1 },                            // INSERT invest log
      // fetch updated unit
      { type: "firstOrNull", result: { ...fakeUnit, product_id: "new-prod" } },
      { type: "firstOrNull", result: null },  // invest log
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "update_unit")({ id: fakeUnit.id, product_id: "new-prod" });

    // Should have withdraw log INSERT and invest log INSERT
    const executeCalls = calls.filter(c => c.sql.includes("INSERT INTO contribution_logs"));
    expect(executeCalls).toHaveLength(2);
  });

  it("should handle product_id set to null (unlink)", async () => {
    const { server, tools } = createMockServer();
    const { db, calls } = createSequentialMockDb([
      { type: "firstOrNull", result: { id: fakeUnit.id, status: "已成立", product_id: "old-prod", end_date: null } },
      { type: "execute", changes: 1 },                       // UPDATE
      // withdraw from old product
      { type: "firstOrNull", result: { name: "Old Product" } },
      { type: "execute", changes: 1 },                       // INSERT withdraw log
      // No invest log (product_id is null)
      { type: "firstOrNull", result: { ...fakeUnit, product_id: null } },
      { type: "firstOrNull", result: null },
    ]);
    registerUnitTools(server, { db, userId });

    await getTool(tools, "update_unit")({ id: fakeUnit.id, product_id: null });

    const insertLogs = calls.filter(c => c.sql.includes("INSERT INTO contribution_logs"));
    expect(insertLogs).toHaveLength(1); // only withdraw, no invest
  });
});
