/**
 * E2E Tests for MCP Product Tools
 *
 * Tests: list_products, get_product, create_product, update_product
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getMcpTestToken, type McpTokenResult } from "../helpers/mcp-auth";
import { mcpCall, mcpInitialize, parseToolResult } from "../helpers/mcp-client";
import { cleanupUser } from "../helpers/cleanup";

// Test user for MCP tests
const MCP_TEST_USER = "e2e-mcp-products";

// ============================================================================
// Types
// ============================================================================

interface Product {
  id: string;
  name: string;
  code?: string;
  channel?: string;
  category?: string;
  currency: string;
  lockPeriodDays: number;
  annualReturnRate?: number;
  isArchived: boolean;
}

// ============================================================================
// Tests
// ============================================================================

describe("E2E: MCP Product Tools", () => {
  let token: McpTokenResult;
  let createdProductId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupUser(MCP_TEST_USER);

    // Get MCP token
    token = await getMcpTestToken(MCP_TEST_USER, "MCP Products Test");

    // Initialize MCP session
    await mcpInitialize(token.accessToken);
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupUser(MCP_TEST_USER);
  });

  describe("create_product", () => {
    test("creates a product with required fields only", async () => {
      const result = await mcpCall(token.accessToken, "create_product", {
        name: "Test Product Basic",
      });

      expect(result.isError).toBeFalsy();
      const product = parseToolResult<Product>(result);
      expect(product.id).toBeDefined();
      expect(product.name).toBe("Test Product Basic");
      expect(product.currency).toBe("CNY"); // Default
      expect(product.lockPeriodDays).toBe(0); // Default
      expect(product.isArchived).toBe(false);

      createdProductId = product.id;
    });

    test("creates a product with all fields", async () => {
      const result = await mcpCall(token.accessToken, "create_product", {
        name: "Test Product Full",
        code: "TP-001",
        channel: "招商银行",
        category: "理财产品",
        currency: "USD",
        lock_period_days: 30,
        annual_return_rate: 4.5,
      });

      expect(result.isError).toBeFalsy();
      const product = parseToolResult<Product>(result);
      expect(product.name).toBe("Test Product Full");
      expect(product.code).toBe("TP-001");
      expect(product.channel).toBe("招商银行");
      expect(product.category).toBe("理财产品");
      expect(product.currency).toBe("USD");
      expect(product.lockPeriodDays).toBe(30);
      expect(product.annualReturnRate).toBe(4.5);
    });
  });

  describe("get_product", () => {
    test("gets a product by ID", async () => {
      const result = await mcpCall(token.accessToken, "get_product", {
        id: createdProductId,
      });

      expect(result.isError).toBeFalsy();
      const product = parseToolResult<Product>(result);
      expect(product.id).toBe(createdProductId);
      expect(product.name).toBe("Test Product Basic");
    });

    test("returns error for non-existent product", async () => {
      const result = await mcpCall(token.accessToken, "get_product", {
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("list_products", () => {
    test("lists all products", async () => {
      const result = await mcpCall(token.accessToken, "list_products", {});

      expect(result.isError).toBeFalsy();
      const products = parseToolResult<Product[]>(result);
      expect(products.length).toBeGreaterThanOrEqual(2);
    });

    test("filters by channel", async () => {
      const result = await mcpCall(token.accessToken, "list_products", {
        channel: "招商银行",
      });

      expect(result.isError).toBeFalsy();
      const products = parseToolResult<Product[]>(result);
      expect(products.every((p) => p.channel === "招商银行")).toBe(true);
    });

    test("filters by currency", async () => {
      const result = await mcpCall(token.accessToken, "list_products", {
        currency: "USD",
      });

      expect(result.isError).toBeFalsy();
      const products = parseToolResult<Product[]>(result);
      expect(products.every((p) => p.currency === "USD")).toBe(true);
    });

    test("supports pagination", async () => {
      const result = await mcpCall(token.accessToken, "list_products", {
        limit: 1,
        offset: 0,
      });

      expect(result.isError).toBeFalsy();
      const products = parseToolResult<Product[]>(result);
      expect(products.length).toBe(1);
    });
  });

  describe("update_product", () => {
    test("updates product name", async () => {
      const result = await mcpCall(token.accessToken, "update_product", {
        id: createdProductId,
        name: "Updated Product Name",
      });

      expect(result.isError).toBeFalsy();
      const product = parseToolResult<Product>(result);
      expect(product.name).toBe("Updated Product Name");
    });

    test("updates multiple fields", async () => {
      const result = await mcpCall(token.accessToken, "update_product", {
        id: createdProductId,
        code: "UP-001",
        channel: "工商银行",
        lock_period_days: 60,
      });

      expect(result.isError).toBeFalsy();
      const product = parseToolResult<Product>(result);
      expect(product.code).toBe("UP-001");
      expect(product.channel).toBe("工商银行");
      expect(product.lockPeriodDays).toBe(60);
    });

    test("archives a product", async () => {
      const result = await mcpCall(token.accessToken, "update_product", {
        id: createdProductId,
        is_archived: true,
      });

      expect(result.isError).toBeFalsy();
      const product = parseToolResult<Product>(result);
      expect(product.isArchived).toBe(true);
    });

    test("archived product excluded from default list", async () => {
      const result = await mcpCall(token.accessToken, "list_products", {});

      expect(result.isError).toBeFalsy();
      const products = parseToolResult<Product[]>(result);
      const archivedProduct = products.find((p) => p.id === createdProductId);
      expect(archivedProduct).toBeUndefined();
    });

    test("archived product included with include_archived", async () => {
      const result = await mcpCall(token.accessToken, "list_products", {
        include_archived: true,
      });

      expect(result.isError).toBeFalsy();
      const products = parseToolResult<Product[]>(result);
      const archivedProduct = products.find((p) => p.id === createdProductId);
      expect(archivedProduct).toBeDefined();
      expect(archivedProduct?.isArchived).toBe(true);
    });

    test("returns error for non-existent product", async () => {
      const result = await mcpCall(token.accessToken, "update_product", {
        id: "00000000-0000-0000-0000-000000000000",
        name: "Should Fail",
      });

      expect(result.isError).toBe(true);
    });
  });
});
