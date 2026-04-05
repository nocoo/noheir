import { describe, test, expect, beforeEach } from "bun:test";
import { api, rawFetch, TEST_USER_A } from "./helpers/client";
import { cleanupUser } from "./helpers/cleanup";
import { makeUnit, makeProduct } from "./helpers/seed";

const userId = TEST_USER_A;

describe("E2E: Units", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  // ── Create ──

  test("POST /api/units creates and returns unit", async () => {
    const res = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });
    expect(res.unit).toBeDefined();
    expect(res.unit.id).toBeString();
    expect(res.unit.amountCents).toBe(5000000);
    expect(res.unit.strategy).toBe("短期理财");
  });

  // ── Read ──

  test("GET /api/units lists all user units", async () => {
    await api({ method: "POST", path: "/api/units", userId, body: makeUnit() });
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U-2025-002" }),
    });

    const res = await api<{ units: unknown[]; total_returned: number }>({
      method: "GET",
      path: "/api/units",
      userId,
    });
    expect(res.total_returned).toBe(2);
  });

  test("GET /api/units/:id returns single unit", async () => {
    const { unit: created } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "GET",
      path: `/api/units/${created.id}`,
      userId,
    });
    expect(unit.id).toBe(created.id);
    expect(unit.unitCode).toBe("U-2025-001");
  });

  test("GET /api/units/:id returns 404 for non-existent", async () => {
    const res = await rawFetch({
      method: "GET",
      path: "/api/units/non-existent-id",
      userId,
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Not found" });
  });

  // ── Update ──

  test("PUT /api/units/:id updates fields", async () => {
    const { unit: created } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    const { unit: updated } = await api<{ unit: Record<string, unknown> }>({
      method: "PUT",
      path: `/api/units/${created.id}`,
      userId,
      body: { status: "已归档", note: "测试归档" },
    });
    expect(updated.status).toBe("已归档");
    expect(updated.note).toBe("测试归档");
  });

  // ── Delete ──

  test("DELETE /api/units/:id removes unit", async () => {
    const { unit: created } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    const res = await api<{ success: boolean }>({
      method: "DELETE",
      path: `/api/units/${created.id}`,
      userId,
    });
    expect(res.success).toBe(true);
  });

  // ── with_products ──

  test("GET /api/units?with_products=true joins product data", async () => {
    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct(),
    });

    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ productId: product.id }),
    });

    const res = await api<{ units: Array<Record<string, unknown>> }>({
      method: "GET",
      path: "/api/units?with_products=true",
      userId,
    });
    expect(res.units).toHaveLength(1);
    expect(res.units[0]!.product).toBeDefined();
    expect((res.units[0]!.product as Record<string, unknown>).name).toBe("招银理财月度宝");
  });

  test("GET /api/units?with_products=true returns null product when unlinked", async () => {
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    const res = await api<{ units: Array<Record<string, unknown>> }>({
      method: "GET",
      path: "/api/units?with_products=true",
      userId,
    });
    expect(res.units).toHaveLength(1);
    expect(res.units[0]!.product).toBeNull();
  });

  // ── Auto-logging on productId change ──

  test("PUT /api/units/:id auto-logs on productId change", async () => {
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

    // Assign product to unit
    await api({
      method: "PUT",
      path: `/api/units/${unit.id}`,
      userId,
      body: { productId: product.id },
    });

    // Check contribution log was created
    const logs = await api<{ logs: Array<Record<string, unknown>> }>({
      method: "POST",
      path: "/api/contribution-logs/search",
      userId,
      body: { source: "auto" },
    });

    expect(logs.logs).toHaveLength(1);
    expect(logs.logs[0]!.operationType).toBe("invest");
    expect(logs.logs[0]!.productId).toBe(product.id);
  });

  test("PUT /api/units/:id creates withdraw + invest when switching products", async () => {
    const { product: productA } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "Product A" }),
    });
    const { product: productB } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "Product B" }),
    });

    // Create unit with productA
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ productId: productA.id }),
    });

    // Switch to productB
    await api({
      method: "PUT",
      path: `/api/units/${unit.id}`,
      userId,
      body: { productId: productB.id },
    });

    // Check both logs were created
    const logs = await api<{ logs: Array<Record<string, unknown>> }>({
      method: "POST",
      path: "/api/contribution-logs/search",
      userId,
      body: { source: "auto" },
    });

    expect(logs.logs).toHaveLength(2);
    const withdraw = logs.logs.find(l => l.operationType === "withdraw");
    const invest = logs.logs.find(l => l.operationType === "invest");

    expect(withdraw).toBeDefined();
    expect(withdraw!.productId).toBe(productA.id);
    expect(invest).toBeDefined();
    expect(invest!.productId).toBe(productB.id);
  });

  test("PUT /api/units/:id rejects productId with other fields", async () => {
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

    const res = await rawFetch({
      method: "PUT",
      path: `/api/units/${unit.id}`,
      userId,
      body: { productId: product.id, note: "This should fail" },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("productId must be updated alone");
  });

  // ── Archive state machine: endDate auto-set/clear ──

  test("PUT /api/units/:id auto-sets endDate when archiving", async () => {
    const { unit: created } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });
    expect(created.endDate).toBeNull();

    const { unit: archived } = await api<{ unit: Record<string, unknown> }>({
      method: "PUT",
      path: `/api/units/${created.id}`,
      userId,
      body: { status: "已归档" },
    });
    expect(archived.status).toBe("已归档");
    expect(archived.endDate).toBeString();
    // Should be today's date
    const today = new Date().toISOString().slice(0, 10);
    expect(archived.endDate).toBe(today);
  });

  test("PUT /api/units/:id allows user override of endDate when archiving", async () => {
    const { unit: created } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    const { unit: archived } = await api<{ unit: Record<string, unknown> }>({
      method: "PUT",
      path: `/api/units/${created.id}`,
      userId,
      body: { status: "已归档", endDate: "2026-01-15" },
    });
    expect(archived.status).toBe("已归档");
    expect(archived.endDate).toBe("2026-01-15");
  });

  test("PUT /api/units/:id clears endDate when un-archiving", async () => {
    const { unit: created } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    // First archive
    await api({
      method: "PUT",
      path: `/api/units/${created.id}`,
      userId,
      body: { status: "已归档" },
    });

    // Then un-archive
    const { unit: unarchived } = await api<{ unit: Record<string, unknown> }>({
      method: "PUT",
      path: `/api/units/${created.id}`,
      userId,
      body: { status: "已成立" },
    });
    expect(unarchived.status).toBe("已成立");
    expect(unarchived.endDate).toBeNull();
  });

  // ── Availability fields ──

  test("GET /api/units?with_products=true includes availability fields", async () => {
    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ lockPeriodDays: 30 }),
    });
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ productId: product.id }),
    });

    // Create invest log
    const today = new Date().toISOString().slice(0, 10);
    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: {
        unitId: unit.id,
        productId: product.id,
        operationType: "invest",
        amountCents: 1000000,
        operationDate: today,
      },
    });

    const res = await api<{ units: Array<Record<string, unknown>> }>({
      method: "GET",
      path: "/api/units?with_products=true",
      userId,
    });

    expect(res.units).toHaveLength(1);
    const u = res.units[0]!;
    expect(u.availableDate).toBeString();
    expect(u.isAvailable).toBe(false); // 30 day lock
    expect(u.daysUntilAvailable).toBe(30);
    expect(u.latestInvestDate).toBe(today);
  });

  test("GET /api/units?with_products=true returns null availability without invest log", async () => {
    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct(),
    });
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ productId: product.id }),
    });

    const res = await api<{ units: Array<Record<string, unknown>> }>({
      method: "GET",
      path: "/api/units?with_products=true",
      userId,
    });

    const u = res.units[0]!;
    expect(u.availableDate).toBeNull();
    expect(u.isAvailable).toBe(false);
    expect(u.daysUntilAvailable).toBeNull();
    expect(u.latestInvestDate).toBeNull();
  });

  test("GET /api/units/:id?with_products=true includes availability fields", async () => {
    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ lockPeriodDays: 0 }), // No lock
    });
    const { unit: created } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ productId: product.id }),
    });

    // Create invest log
    const today = new Date().toISOString().slice(0, 10);
    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: {
        unitId: created.id,
        productId: product.id,
        operationType: "invest",
        amountCents: 1000000,
        operationDate: today,
      },
    });

    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "GET",
      path: `/api/units/${created.id}?with_products=true`,
      userId,
    });

    expect(unit.availableDate).toBe(today);
    expect(unit.isAvailable).toBe(true); // No lock, immediately available
    expect(unit.daysUntilAvailable).toBe(0);
  });
});
