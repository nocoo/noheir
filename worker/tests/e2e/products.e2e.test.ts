import { beforeEach, describe, expect, test } from "vitest";
import { cleanupUser } from "./helpers/cleanup";
import { api, rawFetch, TEST_USER_A } from "./helpers/client";
import { makeContributionLog, makeProduct, makeUnit } from "./helpers/seed";

const userId = TEST_USER_A;

describe("E2E: Products", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  // ── Create ──

  test("POST /api/products creates and returns product", async () => {
    const res = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct(),
    });
    expect(res.product).toBeDefined();
    expect(res.product.id).toBeString();
    expect(res.product.name).toBe("招银理财月度宝");
    expect(res.product.annualReturnRate).toBe(3.2);
  });

  // ── Read ──

  test("GET /api/products lists all user products", async () => {
    await api({ method: "POST", path: "/api/products", userId, body: makeProduct() });
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "Product B", category: "货币基金" }),
    });

    const res = await api<{ products: unknown[]; total_returned: number }>({
      method: "GET",
      path: "/api/products",
      userId,
    });
    expect(res.total_returned).toBe(2);
  });

  test("GET /api/products/:id returns single product", async () => {
    const { product: created } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct(),
    });

    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "GET",
      path: `/api/products/${created.id}`,
      userId,
    });
    expect(product.id).toBe(created.id);
    expect(product.channel).toBe("招商银行");
  });

  test("GET /api/products/:id returns 404 for non-existent", async () => {
    const res = await rawFetch({
      method: "GET",
      path: "/api/products/non-existent-id",
      userId,
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Not found" });
  });

  // ── Update ──

  test("PUT /api/products/:id updates fields", async () => {
    const { product: created } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct(),
    });

    const { product: updated } = await api<{ product: Record<string, unknown> }>({
      method: "PUT",
      path: `/api/products/${created.id}`,
      userId,
      body: { name: "已改名产品", annualReturnRate: 4.5 },
    });
    expect(updated.name).toBe("已改名产品");
    expect(updated.annualReturnRate).toBe(4.5);
  });

  // ── Delete ──

  test("DELETE /api/products/:id removes product", async () => {
    const { product: created } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct(),
    });

    const res = await api<{ success: boolean }>({
      method: "DELETE",
      path: `/api/products/${created.id}`,
      userId,
    });
    expect(res.success).toBe(true);

    const check = await rawFetch({
      method: "GET",
      path: `/api/products/${created.id}`,
      userId,
    });
    expect(check.status).toBe(404);
  });

  // ── Filters ──

  test("GET /api/products?channel= filters by channel", async () => {
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ channel: "招商银行" }),
    });
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "平安产品", channel: "平安银行" }),
    });

    const res = await api<{ products: unknown[]; total_returned: number }>({
      method: "GET",
      path: "/api/products?channel=招商银行",
      userId,
    });
    expect(res.total_returned).toBe(1);
  });

  // ── Deletion guard with contribution logs ──

  test("DELETE /api/products/:id returns 409 when product has contribution logs", async () => {
    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct(),
    });
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    // Create a contribution log referencing the product
    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({ unitId: unit.id, productId: product.id }),
    });

    // Try to delete product
    const res = await rawFetch({
      method: "DELETE",
      path: `/api/products/${product.id}`,
      userId,
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; hasContributionLogs: boolean };
    expect(body.hasContributionLogs).toBe(true);
    expect(body.error).toContain("contribution history");
  });

  test("DELETE /api/products/:id succeeds when product has no contribution logs", async () => {
    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct(),
    });

    const res = await api<{ success: boolean }>({
      method: "DELETE",
      path: `/api/products/${product.id}`,
      userId,
    });

    expect(res.success).toBe(true);
  });

  // ── Summary Endpoint ──

  test("GET /api/products/summary returns empty summary when no products", async () => {
    const res = await api<{
      total_count: number;
      archived_count: number;
      by_channel: Record<string, number>;
      by_category: Record<string, number>;
      by_currency: Record<string, number>;
    }>({
      method: "GET",
      path: "/api/products/summary",
      userId,
    });

    expect(res.total_count).toBe(0);
    expect(res.archived_count).toBe(0);
    expect(Object.keys(res.by_channel)).toHaveLength(0);
    expect(Object.keys(res.by_category)).toHaveLength(0);
    expect(Object.keys(res.by_currency)).toHaveLength(0);
  });

  test("GET /api/products/summary aggregates by channel/category/currency", async () => {
    // Create products with different channels/categories/currencies
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "P1", channel: "招商银行", category: "理财产品", currency: "CNY" }),
    });
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "P2", channel: "招商银行", category: "定期存款", currency: "CNY" }),
    });
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "P3", channel: "支付宝", category: "理财产品", currency: "USD" }),
    });

    const res = await api<{
      total_count: number;
      archived_count: number;
      by_channel: Record<string, number>;
      by_category: Record<string, number>;
      by_currency: Record<string, number>;
    }>({
      method: "GET",
      path: "/api/products/summary",
      userId,
    });

    expect(res.total_count).toBe(3);
    expect(res.archived_count).toBe(0);

    // By channel
    expect(res.by_channel.招商银行).toBe(2);
    expect(res.by_channel.支付宝).toBe(1);

    // By category
    expect(res.by_category.理财产品).toBe(2);
    expect(res.by_category.定期存款).toBe(1);

    // By currency
    expect(res.by_currency.CNY).toBe(2);
    expect(res.by_currency.USD).toBe(1);
  });

  test("GET /api/products/summary excludes archived products by default", async () => {
    // Create active and archived products
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "Active", channel: "招商银行" }),
    });
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "Archived", channel: "支付宝", isArchived: true }),
    });

    const res = await api<{
      total_count: number;
      archived_count: number;
      by_channel: Record<string, number>;
    }>({
      method: "GET",
      path: "/api/products/summary",
      userId,
    });

    // Only active products in breakdown
    expect(res.total_count).toBe(1);
    expect(res.archived_count).toBe(1);
    expect(res.by_channel.招商银行).toBe(1);
    expect(res.by_channel.支付宝).toBeUndefined();
  });

  test("GET /api/products/summary?includeArchived=true includes archived products", async () => {
    // Create active and archived products
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "Active", channel: "招商银行" }),
    });
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "Archived", channel: "支付宝", isArchived: true }),
    });

    const res = await api<{
      total_count: number;
      archived_count: number;
      by_channel: Record<string, number>;
    }>({
      method: "GET",
      path: "/api/products/summary?includeArchived=true",
      userId,
    });

    // All products in breakdown
    expect(res.total_count).toBe(2);
    expect(res.archived_count).toBe(1);
    expect(res.by_channel.招商银行).toBe(1);
    expect(res.by_channel.支付宝).toBe(1);
  });

  // ── Fields and Pagination ──

  test("GET /api/products?fields=minimal returns minimal fields only", async () => {
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "Test Product", lockPeriodDays: 30, annualReturnRate: 3.5 }),
    });

    const res = await api<{ products: Array<Record<string, unknown>>; total_count: number }>({
      method: "GET",
      path: "/api/products?fields=minimal",
      userId,
    });

    expect(res.products).toHaveLength(1);
    const p = res.products[0]!;
    // Should have minimal fields
    expect(p.id).toBeString();
    expect(p.name).toBe("Test Product");
    expect(p.channel).toBe("招商银行");
    expect(p.category).toBe("理财产品"); // default from makeProduct()
    expect(p.currency).toBe("CNY");
    // Should NOT have extra fields
    expect(p.lockPeriodDays).toBeUndefined();
    expect(p.annualReturnRate).toBeUndefined();
    expect(p.createdAt).toBeUndefined();
  });

  test("GET /api/products?fields=full returns all fields (default)", async () => {
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "Full Product", lockPeriodDays: 30 }),
    });

    const res = await api<{ products: Array<Record<string, unknown>> }>({
      method: "GET",
      path: "/api/products?fields=full",
      userId,
    });

    const p = res.products[0]!;
    expect(p.lockPeriodDays).toBe(30);
    expect(p.createdAt).toBeDefined();
  });

  test("GET /api/products with pagination returns correct slice", async () => {
    // Create 5 products
    for (let i = 1; i <= 5; i++) {
      await api({
        method: "POST",
        path: "/api/products",
        userId,
        body: makeProduct({ name: `Product ${i}` }),
      });
    }

    const res = await api<{
      products: Array<Record<string, unknown>>;
      total_returned: number;
      total_count: number;
    }>({
      method: "GET",
      path: "/api/products?limit=2&offset=1",
      userId,
    });

    expect(res.total_count).toBe(5);
    expect(res.total_returned).toBe(2);
    expect(res.products).toHaveLength(2);
  });

  test("GET /api/products returns total_count for pagination", async () => {
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "P1" }),
    });
    await api({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "P2" }),
    });

    const res = await api<{ total_count: number; total_returned: number }>({
      method: "GET",
      path: "/api/products?limit=1",
      userId,
    });

    expect(res.total_count).toBe(2);
    expect(res.total_returned).toBe(1);
  });
});
