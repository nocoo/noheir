/**
 * E2E Tests for MCP Query Tools
 *
 * Tests: query_transactions, query_transfers, get_summary, get_monthly_report
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getMcpTestToken, type McpTokenResult } from "../helpers/mcp-auth";
import { mcpCall, mcpInitialize, parseToolResult } from "../helpers/mcp-client";
import { cleanupUser } from "../helpers/cleanup";
import { api } from "../helpers/client";
import { makeTransaction, makeTransfer } from "../helpers/seed";

// Test user for MCP tests
const MCP_TEST_USER = "e2e-mcp-queries";

// ============================================================================
// Types
// ============================================================================

interface Transaction {
  id: string;
  date: string;
  year: number;
  month: number;
  primaryCategory: string;
  secondaryCategory?: string;
  amountCents: number;
  type: string;
  account: string;
  currency: string;
}

interface Transfer {
  id: string;
  date: string;
  account: string;
  inflowAmountCents: number;
  outflowAmountCents: number;
}

interface QueryTransactionsResult {
  transactions: Transaction[];
  total_returned: number;
}

interface QueryTransfersResult {
  transfers: Transfer[];
  total_returned: number;
}

interface SummaryResult {
  years: number[];
  accounts: string[];
  categories: string[];
  secondary_categories: string[];
  tertiary_categories: string[];
  currencies: string[];
  tags: string[];
  transaction_count: number;
  transfer_count: number;
}

interface MonthlyReportResult {
  total_income: number;
  total_expense: number;
  net_amount: number;
  transaction_count: number;
  transfer_count: number;
  total_transfer_in: number;
  total_transfer_out: number;
  expense_by_category: { category: string; total: number; count: number }[];
  income_by_category: { category: string; total: number; count: number }[];
  currencies: string[];
}

// ============================================================================
// Tests
// ============================================================================

describe("E2E: MCP Query Tools", () => {
  let token: McpTokenResult;

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupUser(MCP_TEST_USER);

    // Get MCP token
    token = await getMcpTestToken(MCP_TEST_USER, "MCP Queries Test");

    // Initialize MCP session
    await mcpInitialize(token.accessToken);

    // Create test transactions via REST API
    await api({
      method: "POST",
      path: "/api/transactions",
      userId: MCP_TEST_USER,
      body: makeTransaction({
        date: "2026-01-15",
        year: 2026,
        month: 1,
        day: 15,
        primaryCategory: "餐饮",
        secondaryCategory: "外卖",
        amountCents: 5000,
        type: "expense",
        account: "招商银行",
        currency: "人民币",
        note: "午餐外卖",
      }),
    });

    await api({
      method: "POST",
      path: "/api/transactions",
      userId: MCP_TEST_USER,
      body: makeTransaction({
        date: "2026-01-20",
        year: 2026,
        month: 1,
        day: 20,
        primaryCategory: "工资",
        amountCents: 2000000,
        type: "income",
        account: "工商银行",
        currency: "人民币",
        note: "月薪",
      }),
    });

    await api({
      method: "POST",
      path: "/api/transactions",
      userId: MCP_TEST_USER,
      body: makeTransaction({
        date: "2026-02-10",
        year: 2026,
        month: 2,
        day: 10,
        primaryCategory: "购物",
        amountCents: 15000,
        type: "expense",
        account: "招商银行",
        currency: "人民币",
        note: "日用品",
      }),
    });

    // Create test transfers via REST API
    await api({
      method: "POST",
      path: "/api/transfers",
      userId: MCP_TEST_USER,
      body: makeTransfer({
        date: "2026-01-25",
        year: 2026,
        month: 1,
        day: 25,
        account: "招商银行",
        transactionType: "转出",
        outflowAmountCents: 100000,
        inflowAmountCents: 0,
        note: "转到储蓄",
      }),
    });
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupUser(MCP_TEST_USER);
  });

  describe("get_summary", () => {
    test("returns metadata summary", async () => {
      const result = await mcpCall(token.accessToken, "get_summary", {});

      expect(result.isError).toBeFalsy();
      const summary = parseToolResult<SummaryResult>(result);

      // Should have data from our test transactions
      expect(summary.categories).toBeDefined();
      expect(summary.accounts).toBeDefined();
      expect(summary.years).toContain(2026);
      expect(summary.transaction_count).toBeGreaterThanOrEqual(3);
      expect(summary.transfer_count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("query_transactions", () => {
    test("queries all transactions", async () => {
      const result = await mcpCall(token.accessToken, "query_transactions", {});

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransactionsResult>(result);
      expect(data.transactions.length).toBeGreaterThanOrEqual(3);
      expect(data.total_returned).toBeGreaterThanOrEqual(3);
    });

    test("filters by type", async () => {
      const result = await mcpCall(token.accessToken, "query_transactions", {
        type: "expense",
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransactionsResult>(result);
      expect(data.transactions.every((t) => t.type === "expense")).toBe(true);
      expect(data.transactions.length).toBeGreaterThanOrEqual(2);
    });

    test("filters by category", async () => {
      const result = await mcpCall(token.accessToken, "query_transactions", {
        categories: ["餐饮"],
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransactionsResult>(result);
      expect(data.transactions.every((t) => t.primaryCategory === "餐饮")).toBe(true);
    });

    test("filters by date range", async () => {
      const result = await mcpCall(token.accessToken, "query_transactions", {
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransactionsResult>(result);
      expect(
        data.transactions.every((t) => t.date >= "2026-01-01" && t.date <= "2026-01-31")
      ).toBe(true);
    });

    test("filters by year and month", async () => {
      const result = await mcpCall(token.accessToken, "query_transactions", {
        year: 2026,
        month: 1,
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransactionsResult>(result);
      expect(data.transactions.every((t) => t.year === 2026 && t.month === 1)).toBe(
        true
      );
    });

    test("filters by account", async () => {
      const result = await mcpCall(token.accessToken, "query_transactions", {
        accounts: ["招商银行"],
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransactionsResult>(result);
      expect(data.transactions.every((t) => t.account === "招商银行")).toBe(true);
    });

    test("searches by keyword", async () => {
      const result = await mcpCall(token.accessToken, "query_transactions", {
        keyword: "外卖",
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransactionsResult>(result);
      expect(data.transactions.length).toBeGreaterThanOrEqual(1);
    });

    test("supports pagination", async () => {
      const result = await mcpCall(token.accessToken, "query_transactions", {
        limit: 1,
        offset: 0,
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransactionsResult>(result);
      expect(data.transactions.length).toBe(1);
    });

    test("filters by amount range", async () => {
      const result = await mcpCall(token.accessToken, "query_transactions", {
        min_amount: 100, // 10000 cents = 100 yuan
        max_amount: 200, // 20000 cents = 200 yuan
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransactionsResult>(result);
      // Should find the 15000 cents (150 yuan) transaction
      expect(data.transactions.some((t) => t.amountCents === 15000)).toBe(true);
    });
  });

  describe("query_transfers", () => {
    test("queries all transfers", async () => {
      const result = await mcpCall(token.accessToken, "query_transfers", {});

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransfersResult>(result);
      expect(data.transfers.length).toBeGreaterThanOrEqual(1);
      expect(data.total_returned).toBeGreaterThanOrEqual(1);
    });

    test("filters by account", async () => {
      const result = await mcpCall(token.accessToken, "query_transfers", {
        accounts: ["招商银行"],
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransfersResult>(result);
      expect(data.transfers.every((t) => t.account === "招商银行")).toBe(true);
    });

    test("filters by date range", async () => {
      const result = await mcpCall(token.accessToken, "query_transfers", {
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransfersResult>(result);
      expect(
        data.transfers.every((t) => t.date >= "2026-01-01" && t.date <= "2026-01-31")
      ).toBe(true);
    });

    test("supports pagination", async () => {
      const result = await mcpCall(token.accessToken, "query_transfers", {
        limit: 1,
        offset: 0,
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<QueryTransfersResult>(result);
      expect(data.transfers.length).toBeLessThanOrEqual(1);
    });
  });

  describe("get_monthly_report", () => {
    test("returns monthly report for January 2026", async () => {
      const result = await mcpCall(token.accessToken, "get_monthly_report", {
        year: 2026,
        month: 1,
      });

      expect(result.isError).toBeFalsy();
      const report = parseToolResult<MonthlyReportResult>(result);

      // Should have income from salary (2000000 cents)
      expect(report.total_income).toBeGreaterThanOrEqual(2000000);
      // Should have expense from lunch (5000 cents)
      expect(report.total_expense).toBeGreaterThanOrEqual(5000);
    });

    test("returns monthly report for February 2026", async () => {
      const result = await mcpCall(token.accessToken, "get_monthly_report", {
        year: 2026,
        month: 2,
      });

      expect(result.isError).toBeFalsy();
      const report = parseToolResult<MonthlyReportResult>(result);

      // Should have expense from shopping (15000 cents)
      expect(report.total_expense).toBeGreaterThanOrEqual(15000);
    });

    test("returns empty report for month with no data", async () => {
      const result = await mcpCall(token.accessToken, "get_monthly_report", {
        year: 2020,
        month: 1,
      });

      expect(result.isError).toBeFalsy();
      const report = parseToolResult<MonthlyReportResult>(result);

      expect(report.total_income).toBe(0);
      expect(report.total_expense).toBe(0);
    });
  });
});
