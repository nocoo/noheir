/**
 * Tests for MCP portfolio tools (registerPortfolioTools)
 *
 * Tests get_product_portfolio via mock McpServer.
 */

import { describe, it, expect } from "bun:test";
import type { Db, DbMeta, DbQueryResult } from "@/lib/db";
import { registerPortfolioTools } from "@/lib/mcp/tools/portfolio";

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

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const SAMPLE_PRODUCT = {
  id: "01ABC123456789012345678901",
  name: "招行定期A",
  code: "CMB-D-001",
  channel: "招商银行",
  category: "定期",
  currency: "CNY",
  lock_period_days: 90,
  annual_return_rate: 3.5,
  is_archived: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const SAMPLE_UNIT_1 = {
  id: "01UNIT11111111111111111111",
  unit_code: "C10",
  amount_cents: 5000000,
  currency: "CNY",
  status: "已成立",
  strategy: "远期理财",
  tactics: "定期存款",
  product_id: SAMPLE_PRODUCT.id,
  start_date: "2026-01-15",
  end_date: null,
  note: null,
  created_at: "2026-01-15T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
  product_name: SAMPLE_PRODUCT.name,
  product_lock_period_days: 90,
};

const SAMPLE_UNIT_2 = {
  id: "01UNIT22222222222222222222",
  unit_code: "C11",
  amount_cents: 3000000,
  currency: "CNY",
  status: "已清算",
  strategy: "短期理财",
  tactics: "活期",
  product_id: SAMPLE_PRODUCT.id,
  start_date: "2026-02-01",
  end_date: "2026-03-01",
  note: null,
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  product_name: SAMPLE_PRODUCT.name,
  product_lock_period_days: 90,
};

const SAMPLE_INVEST_LOG_1 = {
  id: "01LOG111111111111111111111",
  unit_id: SAMPLE_UNIT_1.id,
  operation_type: "invest",
  operation_date: "2026-01-15",
};

const SAMPLE_INVEST_LOG_2 = {
  id: "01LOG222222222222222222222",
  unit_id: SAMPLE_UNIT_2.id,
  operation_type: "invest",
  operation_date: "2026-02-01",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("get_product_portfolio", () => {
  const userId = "user-1";

  it("returns product + units + summary", async () => {
    const { db } = createSequentialMockDb([
      // resolveProduct (query by product_id short)
      { type: "query", results: [SAMPLE_PRODUCT] },
      // units query
      { type: "query", results: [SAMPLE_UNIT_1, SAMPLE_UNIT_2] },
      // invest logs
      { type: "query", results: [SAMPLE_INVEST_LOG_1, SAMPLE_INVEST_LOG_2] },
    ]);

    const { server, tools } = createMockServer();
    registerPortfolioTools(server, { db, userId });

    const handler = getTool(tools, "get_product_portfolio");

    const result = await handler({ product_id: "01ABC123" });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");

    expect(parsed.product.name).toBe("招行定期A");
    expect(parsed.units).toHaveLength(2);
    expect(parsed.summary.total_units).toBe(2);
    expect(parsed.summary.by_status).toEqual({ "已成立": 1, "已清算": 1 });
    expect(parsed.completeness.complete).toBe(true);
    expect(parsed.completeness.truncated).toBe(false);
  });

  it("returns empty units with summary when product has no units", async () => {
    const { db } = createSequentialMockDb([
      // resolveProduct
      { type: "query", results: [SAMPLE_PRODUCT] },
      // units query (empty)
      { type: "query", results: [] },
    ]);

    const { server, tools } = createMockServer();
    registerPortfolioTools(server, { db, userId });

    const handler = getTool(tools, "get_product_portfolio");
    const result = await handler({ product_id: "01ABC123" });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");

    expect(parsed.product.name).toBe("招行定期A");
    expect(parsed.units).toHaveLength(0);
    expect(parsed.summary.total_units).toBe(0);
    expect(parsed.completeness.complete).toBe(true);
  });

  it("returns error when product not found", async () => {
    const { db } = createSequentialMockDb([
      // resolveProduct (not found)
      { type: "query", results: [] },
    ]);

    const { server, tools } = createMockServer();
    registerPortfolioTools(server, { db, userId });

    const handler = getTool(tools, "get_product_portfolio");
    const result = await handler({ product_id: "01NOTFND" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Product not found");
  });

  it("returns error when no identifier provided", async () => {
    const { db } = createSequentialMockDb([]);

    const { server, tools } = createMockServer();
    registerPortfolioTools(server, { db, userId });

    const handler = getTool(tools, "get_product_portfolio");
    const result = await handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("at least one");
  });

  it("excludes archived units by default", async () => {
    const { db, calls } = createSequentialMockDb([
      // resolveProduct
      { type: "query", results: [SAMPLE_PRODUCT] },
      // units query (should filter out 已归档)
      { type: "query", results: [SAMPLE_UNIT_1] },
      // invest logs
      { type: "query", results: [SAMPLE_INVEST_LOG_1] },
    ]);

    const { server, tools } = createMockServer();
    registerPortfolioTools(server, { db, userId });

    const handler = getTool(tools, "get_product_portfolio");
    await handler({ product_id: "01ABC123" });

    // Check that the units query includes status != 已归档
    const unitsQuery = calls.find((c) => c.sql.includes("capital_units") && c.sql.includes("status !="));
    expect(unitsQuery).toBeDefined();
  });

  it("includes archived units when requested", async () => {
    const { db, calls } = createSequentialMockDb([
      // resolveProduct
      { type: "query", results: [SAMPLE_PRODUCT] },
      // units query (no status filter)
      { type: "query", results: [SAMPLE_UNIT_1, SAMPLE_UNIT_2] },
      // invest logs
      { type: "query", results: [SAMPLE_INVEST_LOG_1, SAMPLE_INVEST_LOG_2] },
    ]);

    const { server, tools } = createMockServer();
    registerPortfolioTools(server, { db, userId });

    const handler = getTool(tools, "get_product_portfolio");
    await handler({ product_id: "01ABC123", include_archived_units: true });

    // Check that the units query does NOT include status != 已归档
    const unitsQuery = calls.find((c) => c.sql.includes("capital_units") && !c.sql.includes("status !="));
    expect(unitsQuery).toBeDefined();
  });
});
