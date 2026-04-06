/**
 * E2E Tests for MCP Delete Tools
 *
 * Tests: delete_product, delete_unit
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getMcpTestToken, type McpTokenResult } from "../helpers/mcp-auth";
import { mcpCall, mcpInitialize, parseToolResult } from "../helpers/mcp-client";
import { cleanupUser } from "../helpers/cleanup";

// Test user for MCP tests
const MCP_TEST_USER = "e2e-mcp-deletes";

// ============================================================================
// Types
// ============================================================================

interface Product {
  id: string;
  name: string;
  isArchived: boolean;
}

interface Unit {
  id: string;
  unitCode: string;
  productId?: string;
}

interface DeleteProductResult {
  success: boolean;
  message: string;
  product_id: string;
  unlinked_units: number;
}

interface DeleteUnitResult {
  success: boolean;
  message: string;
  unit_id: string;
  orphaned_logs: number;
}

// ============================================================================
// Tests
// ============================================================================

describe("E2E: MCP Delete Tools", () => {
  let token: McpTokenResult;
  let productToDeleteId: string;
  let productWithUnitsId: string;
  let unitToDeleteId: string;
  let unitWithLogsId: string;
  let linkedUnitId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupUser(MCP_TEST_USER);

    // Get MCP token
    token = await getMcpTestToken(MCP_TEST_USER, "MCP Deletes Test");

    // Initialize MCP session
    await mcpInitialize(token.accessToken);

    // Create a product to delete
    const product1 = await mcpCall(token.accessToken, "create_product", {
      name: "Product to Delete",
      channel: "招商银行",
    });
    productToDeleteId = parseToolResult<Product>(product1).id;

    // Create a product with linked units
    const product2 = await mcpCall(token.accessToken, "create_product", {
      name: "Product with Units",
      channel: "工商银行",
      lock_period_days: 30,
    });
    productWithUnitsId = parseToolResult<Product>(product2).id;

    // Create a unit to delete (no contribution logs)
    const unit1 = await mcpCall(token.accessToken, "create_unit", {
      unit_code: "D01",
      amount_cents: 100000,
    });
    unitToDeleteId = parseToolResult<Unit>(unit1).id;

    // Create a unit linked to product (will test unlinking)
    const unit2 = await mcpCall(token.accessToken, "create_unit", {
      unit_code: "D02",
      amount_cents: 200000,
      product_id: productWithUnitsId,
    });
    linkedUnitId = parseToolResult<Unit>(unit2).id;

    // Create another linked unit
    await mcpCall(token.accessToken, "create_unit", {
      unit_code: "D03",
      amount_cents: 300000,
      product_id: productWithUnitsId,
    });

    // Create a unit that will have contribution logs (via product change)
    const unit4 = await mcpCall(token.accessToken, "create_unit", {
      unit_code: "D04",
      amount_cents: 400000,
    });
    unitWithLogsId = parseToolResult<Unit>(unit4).id;

    // Link to product to create contribution logs
    await mcpCall(token.accessToken, "update_unit", {
      id: unitWithLogsId,
      product_id: productWithUnitsId,
    });
  }, 30000); // 30 second timeout for beforeAll

  afterAll(async () => {
    // Clean up test data
    await cleanupUser(MCP_TEST_USER);
  });

  describe("delete_product", () => {
    test("archives a product with no linked units", async () => {
      const result = await mcpCall(token.accessToken, "delete_product", {
        id: productToDeleteId,
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<DeleteProductResult>(result);

      expect(data.success).toBe(true);
      expect(data.product_id).toBe(productToDeleteId);
      expect(data.unlinked_units).toBe(0);
      expect(data.message).toContain("archived");
    });

    test("archived product no longer in default list", async () => {
      const listResult = await mcpCall(token.accessToken, "list_products", {});
      const products = parseToolResult<Product[]>(listResult);

      const deletedProduct = products.find(
        (p) => p.id === productToDeleteId
      );
      expect(deletedProduct).toBeUndefined();
    });

    test("archives product and unlinks associated units", async () => {
      const result = await mcpCall(token.accessToken, "delete_product", {
        id: productWithUnitsId,
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<DeleteProductResult>(result);

      expect(data.success).toBe(true);
      expect(data.product_id).toBe(productWithUnitsId);
      // Should have unlinked 3 units (D02, D03, and D04)
      expect(data.unlinked_units).toBe(3);
    });

    test("units are unlinked from deleted product", async () => {
      // Check that the linked unit no longer has a productId
      const unitResult = await mcpCall(token.accessToken, "get_unit", {
        id: linkedUnitId,
      });

      expect(unitResult.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(unitResult);

      expect(unit.productId).toBeNull();
    });

    test("returns error for non-existent product", async () => {
      const result = await mcpCall(token.accessToken, "delete_product", {
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("delete_unit", () => {
    test("deletes a unit with no contribution logs", async () => {
      const result = await mcpCall(token.accessToken, "delete_unit", {
        id: unitToDeleteId,
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<DeleteUnitResult>(result);

      expect(data.success).toBe(true);
      expect(data.unit_id).toBe(unitToDeleteId);
      expect(data.orphaned_logs).toBe(0);
    });

    test("deleted unit no longer exists", async () => {
      const result = await mcpCall(token.accessToken, "get_unit", {
        id: unitToDeleteId,
      });

      expect(result.isError).toBe(true);
    });

    test("blocks deletion of unit with contribution logs", async () => {
      const result = await mcpCall(token.accessToken, "delete_unit", {
        id: unitWithLogsId,
      });

      expect(result.isError).toBe(true);

      // Error message should mention contribution logs
      const text = result.content[0].text;
      expect(text).toContain("contribution log");
    });

    test("force deletes unit with contribution logs", async () => {
      const result = await mcpCall(token.accessToken, "delete_unit", {
        id: unitWithLogsId,
        force: true,
      });

      expect(result.isError).toBeFalsy();
      const data = parseToolResult<DeleteUnitResult>(result);

      expect(data.success).toBe(true);
      expect(data.unit_id).toBe(unitWithLogsId);
      expect(data.orphaned_logs).toBeGreaterThan(0);
    });

    test("returns error for non-existent unit", async () => {
      const result = await mcpCall(token.accessToken, "delete_unit", {
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.isError).toBe(true);
    });
  });
});
