/**
 * Tests for MCP query tools (registerQueryTools)
 *
 * Tests query_transactions, query_transfers, get_summary,
 * get_monthly_report, and aggregate_transactions via mock McpServer.
 */

import { describe, it, expect } from "vitest";
import type { Db, DbMeta, DbQueryResult } from "@/lib/db";
import { registerQueryTools } from "@/lib/mcp/tools/query";

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

function createMockDb(overrides: {
  queryResults?: unknown[];
  firstOrNullResult?: unknown;
} = {}) {
  const calls: MockCall[] = [];

  const db: Db = {
    async query<T>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>> {
      calls.push({ sql, params: params ?? [] });
      return {
        results: (overrides.queryResults ?? []) as T[],
        meta: { changes: 0, duration: 1 },
      };
    },
    async firstOrNull<T>(sql: string, params?: unknown[]): Promise<T | null> {
      calls.push({ sql, params: params ?? [] });
      return (overrides.firstOrNullResult ?? null) as T | null;
    },
    async execute(sql: string, params?: unknown[]): Promise<DbMeta> {
      calls.push({ sql, params: params ?? [] });
      return { changes: 0, duration: 1 };
    },
    async batch() {
      return [];
    },
  };

  return { db, calls };
}

// ---------------------------------------------------------------------------
// Mock McpServer — captures tool registrations
// ---------------------------------------------------------------------------

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

function createMockServer() {
  const tools = new Map<string, ToolHandler>();

  const server = {
    tool(name: string, _description: string, _schema: unknown, handler: ToolHandler) {
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
// Tests
// ---------------------------------------------------------------------------

const userId = "user-123";

describe("registerQueryTools", () => {
  it("should register all 5 tools", () => {
    const { server, tools } = createMockServer();
    const { db } = createMockDb();
    registerQueryTools(server, { db, userId });

    expect(tools.has("query_transactions")).toBe(true);
    expect(tools.has("query_transfers")).toBe(true);
    expect(tools.has("get_summary")).toBe(true);
    expect(tools.has("get_monthly_report")).toBe(true);
    expect(tools.has("aggregate_transactions")).toBe(true);
  });
});

describe("query_transactions", () => {
  function setup(queryResults: unknown[] = []) {
    const { server, tools } = createMockServer();
    const { db, calls } = createMockDb({ queryResults });
    registerQueryTools(server, { db, userId });
    return { handler: getTool(tools, "query_transactions"), calls };
  }

  it("should return empty transactions with default params", async () => {
    const { handler } = setup();
    const result = await handler({ limit: 50, offset: 0 });
    const data = parseResult(result);

    expect(data.transactions).toEqual([]);
    expect(data.page.returned).toBe(0);
  });

  it("should always filter by user_id", async () => {
    const { handler, calls } = setup();
    await handler({ limit: 50, offset: 0 });

    expect(at(calls, 0).sql).toContain("user_id = ?");
    expect(at(calls, 0).params[0]).toBe(userId);
  });

  it("should apply keyword filter", async () => {
    const { handler, calls } = setup();
    await handler({ keyword: "lunch", limit: 50, offset: 0 });

    expect(at(calls, 0).sql).toContain("note LIKE ?");
    expect(at(calls, 0).params).toContain("%lunch%");
  });

  it("should apply type filter", async () => {
    const { handler, calls } = setup();
    await handler({ type: "expense", limit: 50, offset: 0 });

    expect(at(calls, 0).sql).toContain("type = ?");
    expect(at(calls, 0).params).toContain("expense");
  });

  it("should apply date range filters", async () => {
    const { handler, calls } = setup();
    await handler({ start_date: "2025-01-01", end_date: "2025-12-31", limit: 50, offset: 0 });

    expect(at(calls, 0).sql).toContain("date >= ?");
    expect(at(calls, 0).sql).toContain("date <= ?");
  });

  it("should apply amount filters (converting to cents)", async () => {
    const { handler, calls } = setup();
    await handler({ min_amount: 100, max_amount: 500, limit: 50, offset: 0 });

    expect(at(calls, 0).sql).toContain("amount_cents >= ?");
    expect(at(calls, 0).sql).toContain("amount_cents <= ?");
    expect(at(calls, 0).params).toContain(10000);
    expect(at(calls, 0).params).toContain(50000);
  });

  it("should apply categories array filter", async () => {
    const { handler, calls } = setup();
    await handler({ categories: ["Food", "Transport"], limit: 50, offset: 0 });

    expect(at(calls, 0).sql).toContain("primary_category IN");
  });

  it("should apply tags array filter using JSON LIKE patterns", async () => {
    const { handler, calls } = setup();
    await handler({ tags: ["food", "work"], limit: 50, offset: 0 });

    const { sql, params } = at(calls, 0);
    // Tags are stored as JSON strings — the filter must use LIKE, not IN.
    expect(sql).toContain("tags LIKE ?");
    expect(sql).not.toContain("tags IN");
    // Each tag contributes two LIKE patterns (normal + double-encoded).
    expect(params).toContain('%"food"%');
    expect(params).toContain('%"work"%');
    expect(params).toContain('%\\"food\\"%');
    expect(params).toContain('%\\"work\\"%');
  });

  it("should apply year and month filters", async () => {
    const { handler, calls } = setup();
    await handler({ year: 2025, month: 6, limit: 50, offset: 0 });

    expect(at(calls, 0).sql).toContain("strftime('%Y', date) = ?");
    expect(at(calls, 0).sql).toContain("strftime('%m', date)");
  });

  it("should apply limit and offset", async () => {
    const { handler, calls } = setup();
    await handler({ limit: 10, offset: 20 });

    const params = at(calls, 0).params;
    expect(params[params.length - 2]).toBe(10);
    expect(params[params.length - 1]).toBe(20);
  });

  it("should transform results to compact format", async () => {
    const rawRow = {
      id: "01ABCDEFGHIJKLMNOPQRSTUVW",
      date: "2025-06-15",
      type: "expense",
      amount_cents: 15050,
      currency: "人民币",
      account: "现金",
      primary_category: "日常支出",
      secondary_category: "餐饮",
      tertiary_category: null,
      note: "Lunch",
      tags: '["food"]',
    };
    const { handler } = setup([rawRow]);
    const result = await handler({ limit: 50, offset: 0 });
    const data = parseResult(result);

    expect(data.transactions).toHaveLength(1);
    const tx = data.transactions[0];
    expect(tx.id).toBe("01ABCDEF");
    expect(tx.amount).toBe(150.50);
    expect(tx.currency).toBe("CNY");
    expect(tx.category).toBe("日常支出/餐饮");
    expect(tx.tags).toEqual(["food"]);
  });
});

describe("query_transfers", () => {
  function setup(queryResults: unknown[] = []) {
    const { server, tools } = createMockServer();
    const { db, calls } = createMockDb({ queryResults });
    registerQueryTools(server, { db, userId });
    return { handler: getTool(tools, "query_transfers"), calls };
  }

  it("should return empty transfers", async () => {
    const { handler } = setup();
    const result = await handler({ limit: 50, offset: 0 });
    const data = parseResult(result);
    expect(data.transfers).toEqual([]);
  });

  it("should always filter by user_id", async () => {
    const { handler, calls } = setup();
    await handler({ limit: 50, offset: 0 });
    expect(at(calls, 0).params[0]).toBe(userId);
  });

  it("should apply keyword filter", async () => {
    const { handler, calls } = setup();
    await handler({ keyword: "rent", limit: 50, offset: 0 });
    expect(at(calls, 0).sql).toContain("note LIKE ?");
  });

  it("should apply accounts filter", async () => {
    const { handler, calls } = setup();
    await handler({ accounts: ["Bank A", "Bank B"], limit: 50, offset: 0 });
    expect(at(calls, 0).sql).toContain("account IN");
  });

  it("should apply date range filters", async () => {
    const { handler, calls } = setup();
    await handler({ start_date: "2025-01-01", end_date: "2025-06-30", limit: 50, offset: 0 });
    expect(at(calls, 0).sql).toContain("date >= ?");
    expect(at(calls, 0).sql).toContain("date <= ?");
  });

  it("should apply year and month filters", async () => {
    const { handler, calls } = setup();
    await handler({ year: 2025, month: 3, limit: 50, offset: 0 });
    expect(at(calls, 0).sql).toContain("year = ?");
    expect(at(calls, 0).sql).toContain("month = ?");
  });

  it("should apply currency filter", async () => {
    const { handler, calls } = setup();
    await handler({ currency: "USD", limit: 50, offset: 0 });
    expect(at(calls, 0).sql).toContain("currency = ?");
  });

  it("should transform transfer results to compact format", async () => {
    const rawRow = {
      id: "01TRANSFERIDABCDEFGHIJKLM",
      date: "2025-06-15",
      inflow_amount_cents: 50000,
      outflow_amount_cents: 0,
      currency: "美元",
      account: "Account A",
      primary_category: "Transfer",
      secondary_category: null,
      transaction_type: "internal",
      note: "Move funds",
      tags: null,
    };
    const { handler } = setup([rawRow]);
    const result = await handler({ limit: 50, offset: 0 });
    const data = parseResult(result);

    expect(data.transfers).toHaveLength(1);
    const t = data.transfers[0];
    expect(t.id).toBe("01TRANSF");
    expect(t.inflow).toBe(500);
    expect(t.currency).toBe("USD");
  });
});

describe("get_summary", () => {
  it("should return counts with no includes", async () => {
    const { server, tools } = createMockServer();
    const { db } = createMockDb({ firstOrNullResult: { transaction_count: 100, transfer_count: 20 } });
    registerQueryTools(server, { db, userId });

    const result = await at([...tools.values()], [...tools.keys()].indexOf("get_summary"))({});
    const data = parseResult(result);

    expect(data.transaction_count).toBe(100);
    expect(data.transfer_count).toBe(20);
  });

  it("should return 0 counts when null", async () => {
    const { server, tools } = createMockServer();
    const { db } = createMockDb({ firstOrNullResult: null });
    registerQueryTools(server, { db, userId });

    const result = await at([...tools.values()], [...tools.keys()].indexOf("get_summary"))({});
    const data = parseResult(result);

    expect(data.transaction_count).toBe(0);
    expect(data.transfer_count).toBe(0);
  });

  it("should fetch years when requested", async () => {
    const { server, tools } = createMockServer();
    const db: Db = {
      async query<T>(): Promise<DbQueryResult<T>> {
        return { results: [{ year: 2025 }, { year: 2024 }] as T[], meta: { changes: 0, duration: 1 } };
      },
      async firstOrNull<T>(): Promise<T | null> {
        return { transaction_count: 10, transfer_count: 5 } as T;
      },
      async execute(): Promise<DbMeta> {
        return { changes: 0, duration: 1 };
      },
      async batch() { return []; },
    };
    registerQueryTools(server, { db, userId });

    const result = await at([...tools.values()], [...tools.keys()].indexOf("get_summary"))({ include: ["years"] });
    const data = parseResult(result);
    expect(data.years).toEqual([2025, 2024]);
  });

  it("should fetch accounts when requested", async () => {
    const { server, tools } = createMockServer();
    const db: Db = {
      async query<T>(): Promise<DbQueryResult<T>> {
        return { results: [{ account: "Cash" }, { account: "Bank" }] as T[], meta: { changes: 0, duration: 1 } };
      },
      async firstOrNull<T>(): Promise<T | null> {
        return { transaction_count: 0, transfer_count: 0 } as T;
      },
      async execute(): Promise<DbMeta> { return { changes: 0, duration: 1 }; },
      async batch() { return []; },
    };
    registerQueryTools(server, { db, userId });

    const result = await at([...tools.values()], [...tools.keys()].indexOf("get_summary"))({ include: ["accounts"] });
    const data = parseResult(result);
    expect(data.accounts).toEqual(["Cash", "Bank"]);
  });

  it("should fetch categories when requested", async () => {
    const { server, tools } = createMockServer();
    const db: Db = {
      async query<T>(): Promise<DbQueryResult<T>> {
        return { results: [{ primary_category: "Food" }] as T[], meta: { changes: 0, duration: 1 } };
      },
      async firstOrNull<T>(): Promise<T | null> {
        return { transaction_count: 0, transfer_count: 0 } as T;
      },
      async execute(): Promise<DbMeta> { return { changes: 0, duration: 1 }; },
      async batch() { return []; },
    };
    registerQueryTools(server, { db, userId });

    const result = await at([...tools.values()], [...tools.keys()].indexOf("get_summary"))({ include: ["categories"] });
    const data = parseResult(result);
    expect(data.categories).toEqual(["Food"]);
  });

  it("should fetch currencies when requested", async () => {
    const { server, tools } = createMockServer();
    const db: Db = {
      async query<T>(): Promise<DbQueryResult<T>> {
        return { results: [{ currency: "CNY" }, { currency: "USD" }] as T[], meta: { changes: 0, duration: 1 } };
      },
      async firstOrNull<T>(): Promise<T | null> {
        return { transaction_count: 0, transfer_count: 0 } as T;
      },
      async execute(): Promise<DbMeta> { return { changes: 0, duration: 1 }; },
      async batch() { return []; },
    };
    registerQueryTools(server, { db, userId });

    const result = await at([...tools.values()], [...tools.keys()].indexOf("get_summary"))({ include: ["currencies"] });
    const data = parseResult(result);
    expect(data.currencies).toEqual(["CNY", "USD"]);
  });
});

describe("get_monthly_report", () => {
  it("should return income, expense, net, and categories", async () => {
    const { server, tools } = createMockServer();
    const db: Db = {
      async query<T>(): Promise<DbQueryResult<T>> {
        return {
          results: [
            { type: "expense", primary_category: "Food", total: 50000 },
            { type: "income", primary_category: "Salary", total: 1000000 },
          ] as T[],
          meta: { changes: 0, duration: 1 },
        };
      },
      async firstOrNull<T>(): Promise<T | null> {
        return { income: 1000000, expense: 50000 } as T;
      },
      async execute(): Promise<DbMeta> { return { changes: 0, duration: 1 }; },
      async batch() { return []; },
    };
    registerQueryTools(server, { db, userId });

    const result = await at([...tools.values()], [...tools.keys()].indexOf("get_monthly_report"))({ year: 2025, month: 6 });
    const data = parseResult(result);

    expect(data.year).toBe(2025);
    expect(data.month).toBe(6);
    expect(data.income).toBe(10000);
    expect(data.expense).toBe(500);
    expect(data.net).toBe(9500);
    expect(data.categories).toHaveLength(2);
  });

  it("should handle null totals", async () => {
    const { server, tools } = createMockServer();
    const db: Db = {
      async query<T>(): Promise<DbQueryResult<T>> {
        return { results: [] as T[], meta: { changes: 0, duration: 1 } };
      },
      async firstOrNull<T>(): Promise<T | null> {
        return null;
      },
      async execute(): Promise<DbMeta> { return { changes: 0, duration: 1 }; },
      async batch() { return []; },
    };
    registerQueryTools(server, { db, userId });

    const result = await at([...tools.values()], [...tools.keys()].indexOf("get_monthly_report"))({ year: 2025, month: 1 });
    const data = parseResult(result);

    expect(data.income).toBe(0);
    expect(data.expense).toBe(0);
    expect(data.net).toBe(0);
  });

  it("should apply currency filter", async () => {
    const { server, tools } = createMockServer();
    const calls: MockCall[] = [];
    const db: Db = {
      async query<T>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>> {
        calls.push({ sql, params: params ?? [] });
        return { results: [] as T[], meta: { changes: 0, duration: 1 } };
      },
      async firstOrNull<T>(sql: string, params?: unknown[]): Promise<T | null> {
        calls.push({ sql, params: params ?? [] });
        return { income: 0, expense: 0 } as T;
      },
      async execute(): Promise<DbMeta> { return { changes: 0, duration: 1 }; },
      async batch() { return []; },
    };
    registerQueryTools(server, { db, userId });

    await at([...tools.values()], [...tools.keys()].indexOf("get_monthly_report"))({ year: 2025, month: 6, currency: "CNY" });

    expect(at(calls, 0).sql).toContain("currency = ?");
    expect(at(calls, 0).params).toContain("CNY");
  });
});

describe("aggregate_transactions", () => {
  function setup(queryResults: unknown[] = []) {
    const { server, tools } = createMockServer();
    const { db, calls } = createMockDb({ queryResults });
    registerQueryTools(server, { db, userId });
    return { handler: getTool(tools, "aggregate_transactions"), calls };
  }

  it("should group by category", async () => {
    const rawRows = [
      { dim1: "Food", total: 50000, count: 10 },
      { dim1: "Transport", total: 20000, count: 5 },
    ];
    const { handler } = setup(rawRows);
    const result = await handler({ group_by: ["category"], year: 2025 });
    const data = parseResult(result);

    expect(data.groups).toHaveLength(2);
    expect(data.groups[0].category).toBe("Food");
    expect(data.groups[0].total).toBe(500);
    expect(data.groups[0].count).toBe(10);
    expect(data.dimensions).toEqual(["category"]);
  });

  it("should group by multiple dimensions", async () => {
    const rawRows = [
      { dim1: "Food", dim2: 6, total: 30000, count: 8 },
    ];
    const { handler } = setup(rawRows);
    const result = await handler({ group_by: ["category", "month"], year: 2025 });
    const data = parseResult(result);

    expect(data.groups[0].category).toBe("Food");
    expect(data.groups[0].month).toBe(6);
  });

  it("should apply type filter", async () => {
    const { handler, calls } = setup();
    await handler({ group_by: ["category"], type: "expense" });

    expect(at(calls, 0).sql).toContain("type = ?");
    expect(at(calls, 0).params).toContain("expense");
  });

  it("should apply year filter", async () => {
    const { handler, calls } = setup();
    await handler({ group_by: ["category"], year: 2025 });

    expect(at(calls, 0).sql).toContain("year = ?");
    expect(at(calls, 0).params).toContain(2025);
  });

  it("should apply month filter", async () => {
    const { handler, calls } = setup();
    await handler({ group_by: ["account"], month: 3 });

    expect(at(calls, 0).sql).toContain("month = ?");
  });

  it("should apply currency filter", async () => {
    const { handler, calls } = setup();
    await handler({ group_by: ["type"], currency: "USD" });

    expect(at(calls, 0).sql).toContain("currency = ?");
    expect(at(calls, 0).params).toContain("USD");
  });

  it("should always filter by user_id", async () => {
    const { handler, calls } = setup();
    await handler({ group_by: ["category"] });

    expect(at(calls, 0).sql).toContain("user_id = ?");
    expect(at(calls, 0).params[0]).toBe(userId);
  });
});
