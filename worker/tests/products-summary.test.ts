/**
 * Unit tests for products-summary.ts
 */

import { describe, test, expect } from "bun:test";
import { buildProductsSummary, type ProductsSummary } from "../lib/products-summary";
import type { FinancialProduct } from "../db/types";

// Helper to create mock product
function mockProduct(overrides: Partial<FinancialProduct> = {}): FinancialProduct {
  return {
    id: "test-id",
    userId: "test-user",
    name: "Test Product",
    code: null,
    channel: "招商银行",
    category: "理财产品",
    currency: "CNY",
    lockPeriodDays: 30,
    annualReturnRate: 3.5,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("buildProductsSummary", () => {
  test("returns empty summary for empty array", () => {
    const summary = buildProductsSummary([], 0);

    expect(summary.total_count).toBe(0);
    expect(summary.archived_count).toBe(0);
    expect(Object.keys(summary.by_channel)).toHaveLength(0);
    expect(Object.keys(summary.by_category)).toHaveLength(0);
    expect(Object.keys(summary.by_currency)).toHaveLength(0);
  });

  test("counts total products correctly", () => {
    const products = [
      mockProduct(),
      mockProduct({ id: "p2" }),
      mockProduct({ id: "p3" }),
    ];

    const summary = buildProductsSummary(products, 5);

    expect(summary.total_count).toBe(3);
    expect(summary.archived_count).toBe(5);
  });

  test("groups by channel", () => {
    const products = [
      mockProduct({ channel: "招商银行" }),
      mockProduct({ channel: "招商银行", id: "p2" }),
      mockProduct({ channel: "支付宝", id: "p3" }),
    ];

    const summary = buildProductsSummary(products, 0);

    expect(summary.by_channel["招商银行"]).toBe(2);
    expect(summary.by_channel["支付宝"]).toBe(1);
  });

  test("groups by category", () => {
    const products = [
      mockProduct({ category: "理财产品" }),
      mockProduct({ category: "定期存款", id: "p2" }),
      mockProduct({ category: "定期存款", id: "p3" }),
    ];

    const summary = buildProductsSummary(products, 0);

    expect(summary.by_category["理财产品"]).toBe(1);
    expect(summary.by_category["定期存款"]).toBe(2);
  });

  test("groups by currency", () => {
    const products = [
      mockProduct({ currency: "CNY" }),
      mockProduct({ currency: "CNY", id: "p2" }),
      mockProduct({ currency: "USD", id: "p3" }),
    ];

    const summary = buildProductsSummary(products, 0);

    expect(summary.by_currency["CNY"]).toBe(2);
    expect(summary.by_currency["USD"]).toBe(1);
  });

  test("handles null channel/category/currency", () => {
    const products = [
      mockProduct({ channel: null, category: null, currency: null }),
    ];

    const summary = buildProductsSummary(products, 0);

    expect(summary.total_count).toBe(1);
    expect(Object.keys(summary.by_channel)).toHaveLength(0);
    expect(Object.keys(summary.by_category)).toHaveLength(0);
    expect(Object.keys(summary.by_currency)).toHaveLength(0);
  });

  test("handles mixed data", () => {
    const products = [
      mockProduct({ channel: "招商银行", category: "理财产品", currency: "CNY" }),
      mockProduct({ channel: "招商银行", category: "定期存款", currency: "CNY", id: "p2" }),
      mockProduct({ channel: "支付宝", category: "理财产品", currency: "USD", id: "p3" }),
      mockProduct({ channel: null, category: null, currency: null, id: "p4" }),
    ];

    const summary = buildProductsSummary(products, 2);

    expect(summary.total_count).toBe(4);
    expect(summary.archived_count).toBe(2);

    expect(summary.by_channel["招商银行"]).toBe(2);
    expect(summary.by_channel["支付宝"]).toBe(1);

    expect(summary.by_category["理财产品"]).toBe(2);
    expect(summary.by_category["定期存款"]).toBe(1);

    expect(summary.by_currency["CNY"]).toBe(2);
    expect(summary.by_currency["USD"]).toBe(1);
  });
});
