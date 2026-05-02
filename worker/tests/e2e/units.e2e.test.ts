import { describe, test, expect, beforeEach } from "vitest";
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
    // Should be today's date in Asia/Shanghai timezone
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
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

  test("POST /api/units clears endDate for non-archived status", async () => {
    // Even if endDate is explicitly provided, it should be cleared for non-archived units
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ endDate: "2026-12-31" }), // Explicitly provide endDate
    });
    // Default status is "已成立", so endDate should be cleared to null
    expect(unit.endDate).toBeNull();
  });

  test("POST /api/units auto-sets endDate when creating archived unit", async () => {
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ status: "已归档" }),
    });
    expect(unit.status).toBe("已归档");
    expect(unit.endDate).toBeString();
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
    expect(unit.endDate).toBe(today);
  });

  test("PUT /api/units/:id clears endDate even when status unchanged", async () => {
    // Create a unit, then try to update with endDate - it should be cleared
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
      body: { note: "test", endDate: "2026-12-31" }, // Try to set endDate
    });
    // Status is still "已成立", so endDate should be cleared
    expect(updated.endDate).toBeNull();
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

  // ── Summary Endpoint ──

  test("GET /api/units/summary returns empty summary when no units", async () => {
    const res = await api<{
      total_count: number;
      total_amount_cents: number;
      by_strategy: Record<string, unknown>;
      by_status: Record<string, unknown>;
      by_tactics: Record<string, unknown>;
      availability: Record<string, unknown>;
    }>({
      method: "GET",
      path: "/api/units/summary",
      userId,
    });

    expect(res.total_count).toBe(0);
    expect(res.total_amount_cents).toBe(0);
    expect(Object.keys(res.by_strategy)).toHaveLength(0);
    expect(Object.keys(res.by_status)).toHaveLength(0);
    expect(Object.keys(res.by_tactics)).toHaveLength(0);
    expect(res.availability).toEqual({
      available_now: { count: 0, amount_cents: 0 },
      available_30d: { count: 0, amount_cents: 0 },
      locked: { count: 0, amount_cents: 0 },
      unknown: { count: 0, amount_cents: 0 },
    });
  });

  test("GET /api/units/summary aggregates by strategy/status/tactics", async () => {
    // Create units with different strategies/statuses/tactics
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U1", amountCents: 1000000, strategy: "短期理财", status: "已成立", tactics: "理财产品" }),
    });
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U2", amountCents: 2000000, strategy: "短期理财", status: "已成立", tactics: "债券基金" }),
    });
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U3", amountCents: 3000000, strategy: "长期理财", status: "计划中", tactics: "理财产品" }),
    });

    const res = await api<{
      total_count: number;
      total_amount_cents: number;
      by_strategy: Record<string, { count: number; amount_cents: number }>;
      by_status: Record<string, { count: number; amount_cents: number }>;
      by_tactics: Record<string, { count: number; amount_cents: number }>;
    }>({
      method: "GET",
      path: "/api/units/summary",
      userId,
    });

    expect(res.total_count).toBe(3);
    expect(res.total_amount_cents).toBe(6000000);

    // By strategy
    expect(res.by_strategy["短期理财"]).toEqual({ count: 2, amount_cents: 3000000 });
    expect(res.by_strategy["长期理财"]).toEqual({ count: 1, amount_cents: 3000000 });

    // By status
    expect(res.by_status["已成立"]).toEqual({ count: 2, amount_cents: 3000000 });
    expect(res.by_status["计划中"]).toEqual({ count: 1, amount_cents: 3000000 });

    // By tactics
    expect(res.by_tactics["理财产品"]).toEqual({ count: 2, amount_cents: 4000000 });
    expect(res.by_tactics["债券基金"]).toEqual({ count: 1, amount_cents: 2000000 });
  });

  test("GET /api/units/summary categorizes availability correctly", async () => {
    // Create a product with 31-day lock (to test "locked" category which is > 30 days)
    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ lockPeriodDays: 31 }),
    });

    // Unit 1: With product and invest log → will be locked (30 days)
    const { unit: unit1 } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U1", amountCents: 1000000, productId: product.id }),
    });

    const today = new Date().toISOString().slice(0, 10);
    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: {
        unitId: unit1.id,
        productId: product.id,
        operationType: "invest",
        amountCents: 1000000,
        operationDate: today,
      },
    });

    // Unit 2: Without product → unknown availability
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U2", amountCents: 2000000 }),
    });

    // Unit 3: With product but no invest log → unknown availability
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U3", amountCents: 3000000, productId: product.id }),
    });

    const res = await api<{
      availability: {
        available_now: { count: number; amount_cents: number };
        available_30d: { count: number; amount_cents: number };
        locked: { count: number; amount_cents: number };
        unknown: { count: number; amount_cents: number };
      };
    }>({
      method: "GET",
      path: "/api/units/summary",
      userId,
    });

    // Unit 1: locked (31 days > 30), Unit 2 & 3: unknown
    expect(res.availability.locked).toEqual({ count: 1, amount_cents: 1000000 });
    expect(res.availability.unknown).toEqual({ count: 2, amount_cents: 5000000 });
    expect(res.availability.available_now).toEqual({ count: 0, amount_cents: 0 });
    expect(res.availability.available_30d).toEqual({ count: 0, amount_cents: 0 });
  });

  // ── Fields and Pagination ──

  test("GET /api/units?fields=minimal returns minimal fields only", async () => {
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U1", note: "secret note" }),
    });

    const res = await api<{ units: Array<Record<string, unknown>>; total_count: number }>({
      method: "GET",
      path: "/api/units?fields=minimal",
      userId,
    });

    expect(res.units).toHaveLength(1);
    const u = res.units[0]!;
    // Should have minimal fields
    expect(u.id).toBeString();
    expect(u.unitCode).toBe("U1");
    expect(u.amountCents).toBe(5000000);
    expect(u.status).toBe("已成立");
    expect(u.strategy).toBe("短期理财");
    expect(u.tactics).toBe("理财产品");
    expect(u.currency).toBe("CNY");
    expect(u.productId).toBeNull();
    // Should NOT have extra fields
    expect(u.note).toBeUndefined();
    expect(u.availableDate).toBeUndefined();
    expect(u.product).toBeUndefined();
  });

  test("GET /api/units?fields=standard returns availability fields", async () => {
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
      path: "/api/units?fields=standard",
      userId,
    });

    const u = res.units[0]!;
    // Should have availability fields
    expect(u.availableDate).toBeString();
    expect(u.isAvailable).toBe(false);
    expect(u.daysUntilAvailable).toBe(30);
    expect(u.latestInvestDate).toBe(today);
    // Should NOT have full product
    expect(u.product).toBeUndefined();
    expect(u.note).toBeUndefined();
  });

  test("GET /api/units?fields=full returns all fields including product", async () => {
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
      body: makeUnit({ productId: product.id, note: "test note" }),
    });

    const res = await api<{ units: Array<Record<string, unknown>> }>({
      method: "GET",
      path: "/api/units?fields=full",
      userId,
    });

    const u = res.units[0]!;
    expect(u.note).toBe("test note");
    expect(u.product).toBeDefined();
    expect((u.product as Record<string, unknown>).name).toBe("招银理财月度宝");
  });

  test("GET /api/units with pagination returns correct slice", async () => {
    // Create 5 units
    for (let i = 1; i <= 5; i++) {
      await api({
        method: "POST",
        path: "/api/units",
        userId,
        body: makeUnit({ unitCode: `U${i}` }),
      });
    }

    const res = await api<{ units: Array<Record<string, unknown>>; total_returned: number; total_count: number }>({
      method: "GET",
      path: "/api/units?limit=2&offset=1",
      userId,
    });

    expect(res.total_count).toBe(5);
    expect(res.total_returned).toBe(2);
    expect(res.units).toHaveLength(2);
  });

  test("GET /api/units?with_products=true still works (backward compatibility)", async () => {
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
    expect(u.product).toBeDefined();
    expect(u.availableDate).toBeDefined(); // Should have availability too
  });

  // ── available_within_days filter ──

  test("GET /api/units?available_within_days filters units by availability", async () => {
    // Create product with 30-day lock
    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ lockPeriodDays: 30 }),
    });

    // Create product with 7-day lock
    const { product: product7 } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ name: "7-day product", lockPeriodDays: 7 }),
    });

    // Unit 1: 30-day lock
    const { unit: unit1 } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U1", productId: product.id }),
    });

    // Unit 2: 7-day lock
    const { unit: unit2 } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U2", productId: product7.id }),
    });

    // Unit 3: No product (unknown availability)
    await api({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ unitCode: "U3" }),
    });

    const today = new Date().toISOString().slice(0, 10);
    // Add invest logs
    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: {
        unitId: unit1.id,
        productId: product.id,
        operationType: "invest",
        amountCents: 1000000,
        operationDate: today,
      },
    });
    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: {
        unitId: unit2.id,
        productId: product7.id,
        operationType: "invest",
        amountCents: 1000000,
        operationDate: today,
      },
    });

    // Filter for units available within 10 days
    const res = await api<{ units: Array<Record<string, unknown>>; total_count: number }>({
      method: "GET",
      path: "/api/units?available_within_days=10",
      userId,
    });

    // Only unit2 (7 days) should match; unit1 (30 days) and unit3 (unknown) excluded
    expect(res.units).toHaveLength(1);
    expect((res.units[0] as Record<string, unknown>).unitCode).toBe("U2");
  });

  test("GET /api/units?available_within_days upgrades minimal to standard", async () => {
    // Create product with 0-day lock (immediately available)
    const { product } = await api<{ product: Record<string, unknown> }>({
      method: "POST",
      path: "/api/products",
      userId,
      body: makeProduct({ lockPeriodDays: 0 }),
    });

    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit({ productId: product.id }),
    });

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

    // Request minimal fields but with available_within_days filter
    const res = await api<{ units: Array<Record<string, unknown>> }>({
      method: "GET",
      path: "/api/units?fields=minimal&available_within_days=30",
      userId,
    });

    // Should return standard fields (upgraded from minimal due to filter)
    const u = res.units[0]!;
    expect(u.availableDate).toBeDefined();
    expect(u.isAvailable).toBe(true);
    expect(u.daysUntilAvailable).toBe(0);
  });
});
