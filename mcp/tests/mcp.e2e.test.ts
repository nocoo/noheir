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
    expect(result.tools.length).toBe(4);

    const toolNames = result.tools.map((t) => t.name).sort();
    expect(toolNames).toEqual(["get_monthly_report", "get_summary", "query_transactions", "query_transfers"]);

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
