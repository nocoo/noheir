/**
 * E2E Tests for MCP Unit Tools
 *
 * Tests: list_units, get_unit, create_unit, update_unit
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getMcpTestToken, type McpTokenResult } from "../helpers/mcp-auth";
import { mcpCall, mcpInitialize, parseToolResult } from "../helpers/mcp-client";
import { cleanupUser } from "../helpers/cleanup";

// Test user for MCP tests
const MCP_TEST_USER = "e2e-mcp-units";

// ============================================================================
// Types
// ============================================================================

interface Product {
  id: string;
  name: string;
  lockPeriodDays: number;
}

interface Unit {
  id: string;
  unitCode: string;
  amountCents: number;
  currency: string;
  status: string;
  strategy?: string;
  tactics?: string;
  productId?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
  product?: Product;
  daysUntilAvailable?: number;
  isAvailable?: boolean;
}

// ============================================================================
// Tests
// ============================================================================

describe("E2E: MCP Unit Tools", () => {
  let token: McpTokenResult;
  let testProductId: string;
  let createdUnitId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupUser(MCP_TEST_USER);

    // Get MCP token
    token = await getMcpTestToken(MCP_TEST_USER, "MCP Units Test");

    // Initialize MCP session
    await mcpInitialize(token.accessToken);

    // Create a test product for unit linking
    const productResult = await mcpCall(token.accessToken, "create_product", {
      name: "Test Product for Units",
      lock_period_days: 30,
    });
    const product = parseToolResult<Product>(productResult);
    testProductId = product.id;
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupUser(MCP_TEST_USER);
  });

  describe("create_unit", () => {
    test("creates a unit with required fields only", async () => {
      const result = await mcpCall(token.accessToken, "create_unit", {
        unit_code: "C01",
        amount_cents: 1000000, // 10,000 CNY
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.id).toBeDefined();
      expect(unit.unitCode).toBe("C01");
      expect(unit.amountCents).toBe(1000000);
      expect(unit.currency).toBe("CNY"); // Default
      expect(unit.status).toBe("已成立"); // Default

      createdUnitId = unit.id;
    });

    test("creates a unit with all fields", async () => {
      const result = await mcpCall(token.accessToken, "create_unit", {
        unit_code: "C02",
        amount_cents: 5000000,
        currency: "USD",
        status: "已成立",
        strategy: "远期理财",
        tactics: "定期存款",
        product_id: testProductId,
        start_date: "2026-01-01",
        note: "Full unit test",
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.unitCode).toBe("C02");
      expect(unit.amountCents).toBe(5000000);
      expect(unit.currency).toBe("USD");
      expect(unit.status).toBe("已成立");
      expect(unit.strategy).toBe("远期理财");
      expect(unit.tactics).toBe("定期存款");
      expect(unit.productId).toBe(testProductId);
      expect(unit.startDate).toBe("2026-01-01");
      expect(unit.note).toBe("Full unit test");
    });

    test("creates archived unit with auto endDate", async () => {
      const result = await mcpCall(token.accessToken, "create_unit", {
        unit_code: "C03",
        amount_cents: 100000,
        status: "已归档",
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.status).toBe("已归档");
      // endDate should be auto-set for archived units
      expect(unit.endDate).toBeDefined();
    });
  });

  describe("get_unit", () => {
    test("gets a unit by ID", async () => {
      const result = await mcpCall(token.accessToken, "get_unit", {
        id: createdUnitId,
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.id).toBe(createdUnitId);
      expect(unit.unitCode).toBe("C01");
    });

    test("returns error for non-existent unit", async () => {
      const result = await mcpCall(token.accessToken, "get_unit", {
        id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.isError).toBe(true);
    });

    test("includes availability info for linked unit", async () => {
      // Get the unit linked to product
      const listResult = await mcpCall(token.accessToken, "list_units", {});
      const units = parseToolResult<Unit[]>(listResult);
      const linkedUnit = units.find((u) => u.productId === testProductId);

      if (linkedUnit) {
        const result = await mcpCall(token.accessToken, "get_unit", {
          id: linkedUnit.id,
        });

        expect(result.isError).toBeFalsy();
        const unit = parseToolResult<Unit>(result);
        expect(unit.product).toBeDefined();
        // Availability info should be present
        expect(unit.daysUntilAvailable).toBeDefined();
      }
    });
  });

  describe("list_units", () => {
    test("lists all units", async () => {
      const result = await mcpCall(token.accessToken, "list_units", {});

      expect(result.isError).toBeFalsy();
      const units = parseToolResult<Unit[]>(result);
      expect(units.length).toBeGreaterThanOrEqual(3);
    });

    test("filters by status", async () => {
      const result = await mcpCall(token.accessToken, "list_units", {
        status: "已成立",
      });

      expect(result.isError).toBeFalsy();
      const units = parseToolResult<Unit[]>(result);
      expect(units.every((u) => u.status === "已成立")).toBe(true);
    });

    test("filters by strategy", async () => {
      const result = await mcpCall(token.accessToken, "list_units", {
        strategy: "远期理财",
      });

      expect(result.isError).toBeFalsy();
      const units = parseToolResult<Unit[]>(result);
      expect(units.every((u) => u.strategy === "远期理财")).toBe(true);
    });

    test("filters by currency", async () => {
      const result = await mcpCall(token.accessToken, "list_units", {
        currency: "USD",
      });

      expect(result.isError).toBeFalsy();
      const units = parseToolResult<Unit[]>(result);
      expect(units.every((u) => u.currency === "USD")).toBe(true);
    });

    test("supports pagination", async () => {
      const result = await mcpCall(token.accessToken, "list_units", {
        limit: 1,
        offset: 0,
      });

      expect(result.isError).toBeFalsy();
      const units = parseToolResult<Unit[]>(result);
      expect(units.length).toBe(1);
    });
  });

  describe("update_unit", () => {
    test("updates unit code", async () => {
      const result = await mcpCall(token.accessToken, "update_unit", {
        id: createdUnitId,
        unit_code: "C01-Updated",
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.unitCode).toBe("C01-Updated");
    });

    test("updates amount", async () => {
      const result = await mcpCall(token.accessToken, "update_unit", {
        id: createdUnitId,
        amount_cents: 2000000,
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.amountCents).toBe(2000000);
    });

    test("links unit to product", async () => {
      const result = await mcpCall(token.accessToken, "update_unit", {
        id: createdUnitId,
        product_id: testProductId,
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.productId).toBe(testProductId);
    });

    test("unlinks unit from product", async () => {
      const result = await mcpCall(token.accessToken, "update_unit", {
        id: createdUnitId,
        product_id: null,
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.productId).toBeNull();
    });

    test("archives unit and auto-sets endDate", async () => {
      const result = await mcpCall(token.accessToken, "update_unit", {
        id: createdUnitId,
        status: "已归档",
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.status).toBe("已归档");
      expect(unit.endDate).toBeDefined();
    });

    test("unarchives unit and clears endDate", async () => {
      const result = await mcpCall(token.accessToken, "update_unit", {
        id: createdUnitId,
        status: "已成立",
      });

      expect(result.isError).toBeFalsy();
      const unit = parseToolResult<Unit>(result);
      expect(unit.status).toBe("已成立");
      expect(unit.endDate).toBeNull();
    });

    test("returns error for non-existent unit", async () => {
      const result = await mcpCall(token.accessToken, "update_unit", {
        id: "00000000-0000-0000-0000-000000000000",
        unit_code: "Should Fail",
      });

      expect(result.isError).toBe(true);
    });
  });
});
