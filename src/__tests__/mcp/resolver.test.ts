/**
 * Tests for MCP entity resolver (resolveProduct)
 */

import { describe, expect, it } from "vitest";
import type { Db, DbQueryResult } from "@/lib/db";
import { type ResolvedProduct, resolveProduct } from "@/lib/mcp/tools/resolver";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_PRODUCT: ResolvedProduct = {
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

const SAMPLE_PRODUCT_2: ResolvedProduct = {
  ...SAMPLE_PRODUCT,
  id: "01DEF987654321098765432109",
  name: "招行定期B",
  code: "CMB-D-002",
};

function createMockDb(
  options: { queryResults?: unknown[][]; firstOrNullResults?: unknown[] } = {},
): Db {
  const { queryResults = [], firstOrNullResults = [] } = options;
  let queryIdx = 0;
  let firstOrNullIdx = 0;

  return {
    async query<T>(_sql: string, _params?: unknown[]): Promise<DbQueryResult<T>> {
      const results = queryResults[queryIdx++] ?? [];
      return { results: results as T[], meta: { changes: 0, duration: 1 } };
    },
    async firstOrNull<T>(_sql: string, _params?: unknown[]): Promise<T | null> {
      return (firstOrNullResults[firstOrNullIdx++] ?? null) as T | null;
    },
    async execute() {
      return { changes: 1, duration: 1 };
    },
    async batch() {
      return [];
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveProduct", () => {
  const userId = "user-1";

  it("returns error when no identifier provided", async () => {
    const db = createMockDb();
    const result = await resolveProduct(db, userId, {});
    expect(result.error).toBe("Provide at least one of: product_id, product_name, product_code");
  });

  // --- product_id (full) ---

  it("resolves by full product_id", async () => {
    const db = createMockDb({ firstOrNullResults: [SAMPLE_PRODUCT] });
    const result = await resolveProduct(db, userId, { product_id: "01ABC123456789012345678901" });

    expect(result.error).toBeUndefined();
    expect(result.product?.id).toBe(SAMPLE_PRODUCT.id);
    expect(result.product?.name).toBe("招行定期A");
  });

  it("returns error when full product_id not found", async () => {
    const db = createMockDb({ firstOrNullResults: [null] });
    const result = await resolveProduct(db, userId, { product_id: "01NOTFOUND00000000000000" });

    expect(result.error).toContain("Product not found");
  });

  // --- product_id (short) ---

  it("resolves by short product_id (8-char prefix)", async () => {
    const db = createMockDb({ queryResults: [[SAMPLE_PRODUCT]] });
    const result = await resolveProduct(db, userId, { product_id: "01ABC123" });

    expect(result.error).toBeUndefined();
    expect(result.product?.id).toBe(SAMPLE_PRODUCT.id);
  });

  it("returns error when short product_id is ambiguous", async () => {
    const db = createMockDb({ queryResults: [[SAMPLE_PRODUCT, SAMPLE_PRODUCT_2]] });
    const result = await resolveProduct(db, userId, { product_id: "01ABC" });

    expect(result.error).toContain("Ambiguous short ID");
  });

  it("returns error when short product_id not found", async () => {
    const db = createMockDb({ queryResults: [[]] });
    const result = await resolveProduct(db, userId, { product_id: "01NOTFND" });

    expect(result.error).toContain("Product not found");
  });

  // --- product_name ---

  it("resolves by product_name", async () => {
    const db = createMockDb({ queryResults: [[SAMPLE_PRODUCT]] });
    const result = await resolveProduct(db, userId, { product_name: "招行定期A" });

    expect(result.error).toBeUndefined();
    expect(result.product?.name).toBe("招行定期A");
  });

  it("returns error when product_name is ambiguous", async () => {
    const db = createMockDb({ queryResults: [[SAMPLE_PRODUCT, SAMPLE_PRODUCT_2]] });
    const result = await resolveProduct(db, userId, { product_name: "招行定期" });

    expect(result.error).toContain("Multiple products named");
  });

  it("returns error when product_name not found", async () => {
    const db = createMockDb({ queryResults: [[]] });
    const result = await resolveProduct(db, userId, { product_name: "不存在的产品" });

    expect(result.error).toContain("Product not found");
  });

  // --- product_code ---

  it("resolves by product_code", async () => {
    const db = createMockDb({ queryResults: [[SAMPLE_PRODUCT]] });
    const result = await resolveProduct(db, userId, { product_code: "CMB-D-001" });

    expect(result.error).toBeUndefined();
    expect(result.product?.code).toBe("CMB-D-001");
  });

  it("returns error when product_code is ambiguous", async () => {
    const db = createMockDb({ queryResults: [[SAMPLE_PRODUCT, SAMPLE_PRODUCT_2]] });
    const result = await resolveProduct(db, userId, { product_code: "CMB" });

    expect(result.error).toContain("Multiple products with code");
  });

  // --- multiple identifiers ---

  it("resolves when multiple identifiers point to same product", async () => {
    // product_id (full) → firstOrNull, product_name → query
    const db = createMockDb({
      firstOrNullResults: [SAMPLE_PRODUCT],
      queryResults: [[SAMPLE_PRODUCT]],
    });
    const result = await resolveProduct(db, userId, {
      product_id: "01ABC123456789012345678901",
      product_name: "招行定期A",
    });

    expect(result.error).toBeUndefined();
    expect(result.product?.id).toBe(SAMPLE_PRODUCT.id);
  });

  it("returns conflict error when identifiers point to different products", async () => {
    const db = createMockDb({
      firstOrNullResults: [SAMPLE_PRODUCT],
      queryResults: [[SAMPLE_PRODUCT_2]],
    });
    const result = await resolveProduct(db, userId, {
      product_id: "01ABC123456789012345678901",
      product_name: "招行定期B",
    });

    expect(result.error).toContain("Conflicting identifiers");
    expect(result.error).toContain("招行定期A");
    expect(result.error).toContain("招行定期B");
  });
});
