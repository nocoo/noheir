/**
 * E2E: MCP Protocol-level tests
 *
 * Spawns the MCP server as a subprocess, communicates via stdio using
 * the MCP SDK client, and verifies the full protocol interaction.
 */

import { describe, it, expect, afterAll, beforeAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createAuthenticatedClient } from "../../tests/e2e/helpers/supabase-client";
import { cleanupUser } from "../../tests/e2e/helpers/cleanup";
import { makeTransaction, makeTransfer } from "../../tests/e2e/helpers/seed";

const SUPABASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

let userId: string;
let refreshToken: string;
let mcpClient: Client;
let transport: StdioClientTransport;

beforeAll(async () => {
  // Create test user and seed data
  const auth = await createAuthenticatedClient("mcp-protocol");
  userId = auth.user.id;
  refreshToken = auth.session.refresh_token;

  // Seed some data for the user
  await auth.client.from("transactions").insert([
    makeTransaction({ note: "协议测试交易1", primary_category: "餐饮", amount: 100 }),
    makeTransaction({ note: "协议测试交易2", primary_category: "交通", amount: 200, type: "income" }),
  ]);

  await auth.client.from("transfers").insert([
    makeTransfer({ note: "协议测试转账1", account: "招商银行", outflow_amount: 500 }),
  ]);

  // Start MCP server as subprocess
  transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "mcp/src/index.ts"],
    env: {
      SUPABASE_URL,
      SUPABASE_ANON_KEY: ANON_KEY,
      SUPABASE_REFRESH_TOKEN: refreshToken,
      PATH: process.env.PATH ?? "",
    },
    stderr: "pipe",
  });

  mcpClient = new Client({
    name: "noheir-test-client",
    version: "1.0.0",
  });

  await mcpClient.connect(transport);
});

afterAll(async () => {
  try {
    await mcpClient?.close();
  } catch {
    // ignore close errors
  }
  if (userId) {
    await cleanupUser(userId);
  }
});

describe("MCP Protocol E2E", () => {
  it("lists all available tools", async () => {
    const result = await mcpClient.listTools();

    expect(result.tools).toBeDefined();
    expect(result.tools.length).toBe(14);

    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual([
      "create_product",
      "create_unit",
      "delete_product",
      "delete_unit",
      "get_monthly_report",
      "get_product",
      "get_summary",
      "get_unit",
      "list_products",
      "list_units",
      "query_transactions",
      "query_transfers",
      "update_product",
      "update_unit",
    ]);

    // Verify each tool has a description and input schema
    for (const tool of result.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("calls query_transactions tool", async () => {
    const result = await mcpClient.callTool({
      name: "query_transactions",
      arguments: { keyword: "协议测试" },
    });

    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);

    // MCP tool results are returned as content blocks
    const textContent = result.content as Array<{ type: string; text: string }>;
    expect(textContent.length).toBeGreaterThan(0);
    expect(textContent[0].type).toBe("text");

    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.transactions.length).toBe(2);
    expect(parsed.total_returned).toBe(2);
  });

  it("calls query_transactions with type filter", async () => {
    const result = await mcpClient.callTool({
      name: "query_transactions",
      arguments: { type: "income" },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.transactions.length).toBe(1);
    expect(parsed.transactions[0].note).toBe("协议测试交易2");
  });

  it("calls query_transfers tool", async () => {
    const result = await mcpClient.callTool({
      name: "query_transfers",
      arguments: {},
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.transfers.length).toBe(1);
    expect(parsed.transfers[0].note).toBe("协议测试转账1");
    expect(parsed.total_returned).toBe(1);
  });

  it("calls get_summary tool", async () => {
    const result = await mcpClient.callTool({
      name: "get_summary",
      arguments: {},
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);

    expect(parsed.transaction_count).toBe(2);
    expect(parsed.transfer_count).toBe(1);
    expect(parsed.years).toContain(2026);
    expect(parsed.accounts).toContain("招商银行");
    expect(parsed.categories).toContain("餐饮");
    expect(parsed.categories).toContain("交通");
    expect(parsed.currencies).toContain("人民币");
    // Verify sub-category metadata is returned
    expect(parsed.secondary_categories).toBeDefined();
    expect(Array.isArray(parsed.secondary_categories)).toBe(true);
    expect(parsed.tertiary_categories).toBeDefined();
    expect(Array.isArray(parsed.tertiary_categories)).toBe(true);
  });

  it("calls get_monthly_report tool", async () => {
    const result = await mcpClient.callTool({
      name: "get_monthly_report",
      arguments: { year: 2026, month: 1 },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);

    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(1);
    expect(parsed.total_income).toBe(200); // 协议测试交易2 income 200
    expect(parsed.total_expense).toBe(100); // 协议测试交易1 expense 100
    expect(parsed.net_amount).toBe(100); // 200 - 100
    expect(parsed.transaction_count).toBe(2);
    expect(parsed.transfer_count).toBe(1);
    expect(parsed.expense_by_category).toBeDefined();
    expect(parsed.income_by_category).toBeDefined();
    expect(parsed.currencies).toContain("人民币");
  });

  it("handles empty results gracefully", async () => {
    const result = await mcpClient.callTool({
      name: "query_transactions",
      arguments: { keyword: "完全不存在的关键词xyz" },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.transactions).toEqual([]);
    expect(parsed.total_returned).toBe(0);
  });
});

// ============================================================================
// CRUD Protocol E2E
// ============================================================================

describe("MCP Protocol E2E - Product CRUD", () => {
  let productId: string;

  it("creates a product via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "create_product",
      arguments: {
        name: "MCP协议测试基金",
        channel: "招商银行",
        category: "债券基金",
        currency: "CNY",
        lock_period_days: 30,
        annual_return_rate: 3.5,
      },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.product).toBeDefined();
    expect(parsed.product.name).toBe("MCP协议测试基金");
    expect(parsed.product.channel).toBe("招商银行");
    expect(parsed.product.annual_return_rate).toBe(3.5);
    productId = parsed.product.id;
  });

  it("lists products via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "list_products",
      arguments: { channel: "招商银行" },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.products.length).toBeGreaterThanOrEqual(1);
    expect(parsed.products.some((p: any) => p.name === "MCP协议测试基金")).toBe(true);
  });

  it("gets a product by id via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "get_product",
      arguments: { id: productId },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.product).toBeDefined();
    expect(parsed.product.id).toBe(productId);
    expect(parsed.product.name).toBe("MCP协议测试基金");
  });

  it("updates a product via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "update_product",
      arguments: { id: productId, name: "MCP更新后基金", lock_period_days: 90 },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.product.name).toBe("MCP更新后基金");
    expect(parsed.product.lock_period_days).toBe(90);
  });

  it("deletes a product via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "delete_product",
      arguments: { id: productId },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.success).toBe(true);

    // Verify it's gone
    const getResult = await mcpClient.callTool({
      name: "get_product",
      arguments: { id: productId },
    });
    const getParsed = JSON.parse((getResult.content as Array<{ type: string; text: string }>)[0].text);
    expect(getParsed.product).toBeNull();
  });
});

describe("MCP Protocol E2E - Unit CRUD", () => {
  let unitId: string;
  let productId: string;

  // Create a product to link units to
  it("creates a product for unit linking", async () => {
    const result = await mcpClient.callTool({
      name: "create_product",
      arguments: { name: "Unit关联产品", channel: "支付宝", category: "货币基金" },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    productId = parsed.product.id;
  });

  it("creates a unit via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "create_unit",
      arguments: {
        unit_code: "MCP-U001",
        amount: 50000,
        strategy: "短期理财",
        tactics: "债券基金",
        product_id: productId,
        start_date: "2026-02-01",
        note: "MCP协议测试",
      },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.unit).toBeDefined();
    expect(parsed.unit.unit_code).toBe("MCP-U001");
    expect(parsed.unit.amount).toBe(50000);
    expect(parsed.unit.product_id).toBe(productId);
    unitId = parsed.unit.id;
  });

  it("lists units via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "list_units",
      arguments: { strategy: "短期理财" },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.units.length).toBeGreaterThanOrEqual(1);
    expect(parsed.units.some((u: any) => u.unit_code === "MCP-U001")).toBe(true);
  });

  it("lists units with products via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "list_units",
      arguments: { with_products: true },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    const linked = parsed.units.find((u: any) => u.unit_code === "MCP-U001");
    expect(linked).toBeDefined();
    expect(linked.product).toBeDefined();
    expect(linked.product.name).toBe("Unit关联产品");
  });

  it("gets a unit by id via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "get_unit",
      arguments: { id: unitId, with_product: true },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.unit).toBeDefined();
    expect(parsed.unit.id).toBe(unitId);
    expect(parsed.unit.product).toBeDefined();
    expect(parsed.unit.product.name).toBe("Unit关联产品");
  });

  it("updates a unit via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "update_unit",
      arguments: { id: unitId, amount: 80000, note: "更新备注" },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.unit.amount).toBe(80000);
    expect(parsed.unit.note).toBe("更新备注");
  });

  it("deletes a unit via MCP protocol", async () => {
    const result = await mcpClient.callTool({
      name: "delete_unit",
      arguments: { id: unitId },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.success).toBe(true);

    // Verify it's gone
    const getResult = await mcpClient.callTool({
      name: "get_unit",
      arguments: { id: unitId },
    });
    const getParsed = JSON.parse((getResult.content as Array<{ type: string; text: string }>)[0].text);
    expect(getParsed.unit).toBeNull();
  });

  it("cleans up product", async () => {
    const result = await mcpClient.callTool({
      name: "delete_product",
      arguments: { id: productId },
    });

    const textContent = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(textContent[0].text);
    expect(parsed.success).toBe(true);
  });
});
