import { describe, test, expect, beforeEach } from "bun:test";
import { api, rawFetch, TEST_USER_A } from "./helpers/client";
import { cleanupUser } from "./helpers/cleanup";
import { makeProduct, makeUnit, makeContributionLog } from "./helpers/seed";

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
});
