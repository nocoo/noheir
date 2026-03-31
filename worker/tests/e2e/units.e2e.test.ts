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
});
