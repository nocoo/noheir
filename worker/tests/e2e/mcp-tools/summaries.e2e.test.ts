/**
 * E2E Tests for MCP Summary Tools
 *
 * Tests: get_products_summary, get_units_summary
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getMcpTestToken, type McpTokenResult } from "../helpers/mcp-auth";
import { mcpCall, mcpInitialize, parseToolResult } from "../helpers/mcp-client";
import { cleanupUser } from "../helpers/cleanup";

// Test user for MCP tests
const MCP_TEST_USER = "e2e-mcp-summaries";

// ============================================================================
// Types
// ============================================================================

interface Product {
  id: string;
  name: string;
}

interface ProductsSummaryResult {
  total_count: number;
  archived_count: number;
  by_channel: Record<string, number>;
  by_category: Record<string, number>;
  by_currency: Record<string, number>;
}

interface UnitsSummaryResult {
  total_count: number;
  total_amount_cents: number;
  by_strategy: Record<string, { count: number; amount_cents: number }>;
  by_status: Record<string, { count: number; amount_cents: number }>;
  by_tactics: Record<string, { count: number; amount_cents: number }>;
  availability: {
    available_now: { count: number; amount_cents: number };
    available_30d: { count: number; amount_cents: number };
    locked: { count: number; amount_cents: number };
    unknown: { count: number; amount_cents: number };
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("E2E: MCP Summary Tools", () => {
  let token: McpTokenResult;
  let testProductId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupUser(MCP_TEST_USER);

    // Get MCP token
    token = await getMcpTestToken(MCP_TEST_USER, "MCP Summaries Test");

    // Initialize MCP session
    await mcpInitialize(token.accessToken);

    // Create test products
    const product1 = await mcpCall(token.accessToken, "create_product", {
      name: "Summary Test Product 1",
      channel: "招商银行",
      category: "理财产品",
      currency: "CNY",
      lock_period_days: 30,
    });
    testProductId = parseToolResult<Product>(product1).id;

    await mcpCall(token.accessToken, "create_product", {
      name: "Summary Test Product 2",
      channel: "工商银行",
      category: "基金",
      currency: "USD",
    });

    // Create a product and then archive it (create doesn't support is_archived)
    const archivedProduct = await mcpCall(token.accessToken, "create_product", {
      name: "Archived Product",
      channel: "招商银行",
      category: "理财产品",
      currency: "CNY",
    });
    const archivedProductId = parseToolResult<Product>(archivedProduct).id;
    await mcpCall(token.accessToken, "update_product", {
      id: archivedProductId,
      is_archived: true,
    });

    // Create test units
    await mcpCall(token.accessToken, "create_unit", {
      unit_code: "S01",
      amount_cents: 1000000,
      currency: "CNY",
      status: "已成立",
      strategy: "远期理财",
      tactics: "定期存款",
      product_id: testProductId,
    });

    await mcpCall(token.accessToken, "create_unit", {
      unit_code: "S02",
      amount_cents: 500000,
      currency: "CNY",
      status: "已成立",
      strategy: "短期理财",
      tactics: "活期存款",
    });

    await mcpCall(token.accessToken, "create_unit", {
      unit_code: "S03",
      amount_cents: 200000,
      currency: "USD",
      status: "已清算",
      strategy: "远期理财",
      tactics: "理财产品",
    });
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupUser(MCP_TEST_USER);
  });

  describe("get_products_summary", () => {
    test("returns summary excluding archived by default", async () => {
      const result = await mcpCall(
        token.accessToken,
        "get_products_summary",
        {}
      );

      expect(result.isError).toBeFalsy();
      const summary = parseToolResult<ProductsSummaryResult>(result);

      // Should have 2 active products
      expect(summary.total_count).toBeGreaterThanOrEqual(2);
      // Should have 1 archived product
      expect(summary.archived_count).toBeGreaterThanOrEqual(1);

      // Channel breakdown
      expect(summary.by_channel["招商银行"]).toBe(1);
      expect(summary.by_channel["工商银行"]).toBe(1);

      // Category breakdown
      expect(summary.by_category["理财产品"]).toBe(1);
      expect(summary.by_category["基金"]).toBe(1);

      // Currency breakdown
      expect(summary.by_currency["CNY"]).toBe(1);
      expect(summary.by_currency["USD"]).toBe(1);
    });

    test("includes archived when requested", async () => {
      const result = await mcpCall(token.accessToken, "get_products_summary", {
        include_archived: true,
      });

      expect(result.isError).toBeFalsy();
      const summary = parseToolResult<ProductsSummaryResult>(result);

      // Should have 3 total products (including archived)
      expect(summary.total_count).toBe(3);

      // Channel breakdown should include archived
      expect(summary.by_channel["招商银行"]).toBe(2); // 1 active + 1 archived
      expect(summary.by_channel["工商银行"]).toBe(1);
    });
  });

  describe("get_units_summary", () => {
    test("returns units summary", async () => {
      const result = await mcpCall(token.accessToken, "get_units_summary", {});

      expect(result.isError).toBeFalsy();
      const summary = parseToolResult<UnitsSummaryResult>(result);

      // Total counts
      expect(summary.total_count).toBe(3);
      // Total amount: 1000000 + 500000 + 200000 = 1700000
      expect(summary.total_amount_cents).toBe(1700000);

      // Strategy breakdown
      expect(summary.by_strategy["远期理财"].count).toBe(2);
      expect(summary.by_strategy["远期理财"].amount_cents).toBe(1200000);
      expect(summary.by_strategy["短期理财"].count).toBe(1);
      expect(summary.by_strategy["短期理财"].amount_cents).toBe(500000);

      // Status breakdown
      expect(summary.by_status["已成立"].count).toBe(2);
      expect(summary.by_status["已成立"].amount_cents).toBe(1500000);
      expect(summary.by_status["已清算"].count).toBe(1);
      expect(summary.by_status["已清算"].amount_cents).toBe(200000);

      // Tactics breakdown
      expect(summary.by_tactics["定期存款"].count).toBe(1);
      expect(summary.by_tactics["活期存款"].count).toBe(1);
      expect(summary.by_tactics["理财产品"].count).toBe(1);
    });

    test("includes availability breakdown", async () => {
      const result = await mcpCall(token.accessToken, "get_units_summary", {});

      expect(result.isError).toBeFalsy();
      const summary = parseToolResult<UnitsSummaryResult>(result);

      // Availability should be present
      expect(summary.availability).toBeDefined();
      expect(summary.availability.available_now).toBeDefined();
      expect(summary.availability.available_30d).toBeDefined();
      expect(summary.availability.locked).toBeDefined();
      expect(summary.availability.unknown).toBeDefined();

      // Units without invest logs should be "unknown"
      // S01 is linked to product but no invest log yet
      // S02 has no product
      // S03 has no product
      const totalAvailability =
        summary.availability.available_now.count +
        summary.availability.available_30d.count +
        summary.availability.locked.count +
        summary.availability.unknown.count;

      expect(totalAvailability).toBe(3);
    });
  });
});
