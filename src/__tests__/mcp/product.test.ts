/**
 * Tests for MCP product tools (registerProductTools)
 *
 * Tests get_product enhancement with linked_units_count, linked_units_amount, and next hint.
 */

import { describe, it, expect } from "vitest";
import type { Db, DbMeta, DbQueryResult } from "@/lib/db";
import { registerProductTools } from "@/lib/mcp/tools/product";

// ---------------------------------------------------------------------------
// Mock Db
// ---------------------------------------------------------------------------

interface MockCall {
  sql: string;
  params: unknown[];
}

function createSequentialMockDb(
  responses: Array<
    | { type: "query"; results: unknown[] }
    | { type: "firstOrNull"; result: unknown }
    | { type: "execute"; changes?: number }
  >,
) {
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
    async batch() {
      return [];
    },
  };

  return { db, calls };
}

// ---------------------------------------------------------------------------
// Mock McpServer
// ---------------------------------------------------------------------------

type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

function createMockServer() {
  const tools = new Map<string, ToolHandler>();

  const server = {
    tool(name: string, _desc: string, _schema: unknown, handler: ToolHandler) {
      tools.set(name, handler);
    },
  };

  return {
    server: server as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer,
    tools,
  };
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("get_product", () => {
  const userId = "user-1";

  it("returns product with linked units count and amount", async () => {
    const { db } = createSequentialMockDb([
      // product query
      { type: "query", results: [SAMPLE_PRODUCT] },
      // count query
      { type: "firstOrNull", result: { total: 3 } },
      // amount query
      { type: "query", results: [{ currency: "CNY", total_cents: 13000000 }] },
    ]);

    const { server, tools } = createMockServer();
    registerProductTools(server, { db, userId });

    const handler = getTool(tools, "get_product");
    const result = await handler({ id: "01ABC123" });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");

    expect(parsed.name).toBe("招行定期A");
    expect(parsed.linked_units_count).toBe(3);
    expect(parsed.linked_units_amount).toEqual({ CNY: 130000 });
    expect(parsed.completeness.complete).toBe(true);
    expect(parsed.completeness.truncated).toBe(false);
    expect(parsed.next).toBeDefined();
    expect(parsed.next.recommended).toBe("related_tool");
    expect(parsed.next.tool).toBe("get_product_portfolio");
    expect(parsed.next.args.product_id).toBe(SAMPLE_PRODUCT.id);
  });

  it("returns product without next hint when no linked units", async () => {
    const { db } = createSequentialMockDb([
      // product query
      { type: "query", results: [SAMPLE_PRODUCT] },
      // count query (0 units)
      { type: "firstOrNull", result: { total: 0 } },
      // amount query (empty)
      { type: "query", results: [] },
    ]);

    const { server, tools } = createMockServer();
    registerProductTools(server, { db, userId });

    const handler = getTool(tools, "get_product");
    const result = await handler({ id: "01ABC123" });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");

    expect(parsed.linked_units_count).toBe(0);
    expect(parsed.linked_units_amount).toBeNull();
    expect(parsed.next).toBeUndefined();
  });

  it("returns product with multiple currencies", async () => {
    const { db } = createSequentialMockDb([
      // product query
      { type: "query", results: [SAMPLE_PRODUCT] },
      // count query
      { type: "firstOrNull", result: { total: 2 } },
      // amount query (multiple currencies)
      {
        type: "query",
        results: [
          { currency: "CNY", total_cents: 5000000 },
          { currency: "USD", total_cents: 200000 },
        ],
      },
    ]);

    const { server, tools } = createMockServer();
    registerProductTools(server, { db, userId });

    const handler = getTool(tools, "get_product");
    const result = await handler({ id: "01ABC123" });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}");

    expect(parsed.linked_units_count).toBe(2);
    expect(parsed.linked_units_amount).toEqual({ CNY: 50000, USD: 2000 });
  });

  it("returns error when product not found", async () => {
    const { db } = createSequentialMockDb([
      // product query (not found)
      { type: "query", results: [] },
    ]);

    const { server, tools } = createMockServer();
    registerProductTools(server, { db, userId });

    const handler = getTool(tools, "get_product");
    const result = await handler({ id: "01NOTFND" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Product not found");
  });

  it("returns error when short ID is ambiguous", async () => {
    const { db } = createSequentialMockDb([
      // product query (ambiguous - 2 results)
      {
        type: "query",
        results: [SAMPLE_PRODUCT, { ...SAMPLE_PRODUCT, id: "01ABC999999999999999999999" }],
      },
    ]);

    const { server, tools } = createMockServer();
    registerProductTools(server, { db, userId });

    const handler = getTool(tools, "get_product");
    const result = await handler({ id: "01ABC" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Ambiguous");
  });
});
