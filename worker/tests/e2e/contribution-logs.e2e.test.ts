import { beforeEach, describe, expect, test } from "vitest";
import { cleanupUser } from "./helpers/cleanup";
import { api, rawFetch, TEST_USER_A } from "./helpers/client";
import { makeContributionLog, makeProduct, makeUnit } from "./helpers/seed";

const userId = TEST_USER_A;

describe("E2E: Contribution Logs", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  // ── Create ──

  test("POST /api/contribution-logs creates and returns log", async () => {
    // Setup: create unit
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    const res = await api<{ log: Record<string, unknown> }>({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({ unitId: unit.id }),
    });

    expect(res.log).toBeDefined();
    expect(res.log.id).toBeString();
    expect(res.log.unitId).toBe(unit.id);
    expect(res.log.operationType).toBe("invest");
    expect(res.log.amountCents).toBe(100000);
  });

  test("POST /api/contribution-logs validates unitId exists", async () => {
    // Use a valid UUID format that doesn't exist in the database
    const nonExistentUnitId = "00000000-0000-0000-0000-000000000000";
    const res = await rawFetch({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({ unitId: nonExistentUnitId }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Unit not found");
  });

  test("POST /api/contribution-logs validates required fields", async () => {
    const res = await rawFetch({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: { amountCents: 100000 },
    });

    expect(res.status).toBe(400);
  });

  // ── Search ──

  test("POST /api/contribution-logs/search filters correctly", async () => {
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    // Create multiple logs
    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({ unitId: unit.id, operationType: "invest" }),
    });
    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({
        unitId: unit.id,
        operationType: "withdraw",
        amountCents: -50000,
      }),
    });

    // Search all
    const all = await api<{ logs: unknown[]; total: number }>({
      method: "POST",
      path: "/api/contribution-logs/search",
      userId,
      body: {},
    });
    expect(all.logs).toHaveLength(2);

    // Filter by operationType
    const invest = await api<{ logs: unknown[] }>({
      method: "POST",
      path: "/api/contribution-logs/search",
      userId,
      body: { operationType: "invest" },
    });
    expect(invest.logs).toHaveLength(1);
  });

  // ── Summary ──

  test("GET /api/contribution-logs/summary/unit/:id returns totals", async () => {
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({ unitId: unit.id, amountCents: 100000 }),
    });
    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({
        unitId: unit.id,
        operationType: "withdraw",
        amountCents: -30000,
      }),
    });

    const res = await api<{
      summary: {
        totalInvested: number;
        totalWithdrawn: number;
        netAmount: number;
        logCount: number;
      };
    }>({
      method: "GET",
      path: `/api/contribution-logs/summary/unit/${unit.id}`,
      userId,
    });

    expect(res.summary.totalInvested).toBe(100000);
    expect(res.summary.totalWithdrawn).toBe(30000);
    expect(res.summary.netAmount).toBe(70000);
    expect(res.summary.logCount).toBe(2);
  });

  test("GET /api/contribution-logs/summary/product/:id returns totals", async () => {
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

    await api({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({
        unitId: unit.id,
        productId: product.id,
        amountCents: 200000,
      }),
    });

    const res = await api<{
      summary: { totalInvested: number; netAmount: number; unitCount: number };
    }>({
      method: "GET",
      path: `/api/contribution-logs/summary/product/${product.id}`,
      userId,
    });

    expect(res.summary.totalInvested).toBe(200000);
    expect(res.summary.netAmount).toBe(200000);
    expect(res.summary.unitCount).toBe(1);
  });

  // ── Delete and Restore ──

  test("DELETE soft-deletes and POST restore recovers", async () => {
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    const { log } = await api<{ log: Record<string, unknown> }>({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({ unitId: unit.id }),
    });

    // Soft delete
    const deleted = await api<{ success: boolean }>({
      method: "DELETE",
      path: `/api/contribution-logs/${log.id}`,
      userId,
    });
    expect(deleted.success).toBe(true);

    // Search without includeDeleted
    const hidden = await api<{ logs: unknown[] }>({
      method: "POST",
      path: "/api/contribution-logs/search",
      userId,
      body: {},
    });
    expect(hidden.logs).toHaveLength(0);

    // Search with includeDeleted
    const found = await api<{ logs: unknown[] }>({
      method: "POST",
      path: "/api/contribution-logs/search",
      userId,
      body: { includeDeleted: true },
    });
    expect(found.logs).toHaveLength(1);

    // Restore
    const restored = await api<{ log: Record<string, unknown> }>({
      method: "POST",
      path: `/api/contribution-logs/${log.id}/restore`,
      userId,
    });
    expect(restored.log).toBeDefined();

    // Now visible again
    const visible = await api<{ logs: unknown[] }>({
      method: "POST",
      path: "/api/contribution-logs/search",
      userId,
      body: {},
    });
    expect(visible.logs).toHaveLength(1);
  });

  // ── Update ──

  test("PUT /api/contribution-logs/:id updates log", async () => {
    const { unit } = await api<{ unit: Record<string, unknown> }>({
      method: "POST",
      path: "/api/units",
      userId,
      body: makeUnit(),
    });

    const { log } = await api<{ log: Record<string, unknown> }>({
      method: "POST",
      path: "/api/contribution-logs",
      userId,
      body: makeContributionLog({ unitId: unit.id }),
    });

    const updated = await api<{ log: Record<string, unknown> }>({
      method: "PUT",
      path: `/api/contribution-logs/${log.id}`,
      userId,
      body: { amountCents: 150000, note: "Updated" },
    });

    expect(updated.log.amountCents).toBe(150000);
    expect(updated.log.note).toBe("Updated");
  });
});
