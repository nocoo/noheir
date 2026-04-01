import { describe, test, expect, beforeEach } from "bun:test";
import { api, rawFetch, TEST_USER_A } from "./helpers/client";
import { cleanupUser } from "./helpers/cleanup";
import { makeTransfer } from "./helpers/seed";

const userId = TEST_USER_A;

describe("E2E: Transfers", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  // ── Create ──

  test("POST /api/transfers creates and returns transfer", async () => {
    const data = makeTransfer();
    const res = await api<{ transfer: Record<string, unknown> }>({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: data,
    });
    expect(res.transfer).toBeDefined();
    expect(res.transfer.id).toBeString();
    expect(res.transfer.outflowAmountCents).toBe(100000);
  });

  test("POST /api/transfers returns 201 status", async () => {
    const res = await rawFetch({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer(),
    });
    expect(res.status).toBe(201);
  });

  // ── Read ──

  test("GET /api/transfers/:id returns created transfer", async () => {
    const { transfer: created } = await api<{ transfer: Record<string, unknown> }>({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer(),
    });

    const { transfer } = await api<{ transfer: Record<string, unknown> }>({
      method: "GET",
      path: `/api/transfers/${created.id}`,
      userId,
    });
    expect(transfer.id).toBe(created.id);
    expect(transfer.note).toBe("转到储蓄账户");
  });

  test("GET /api/transfers/:id returns 404 for non-existent", async () => {
    const res = await rawFetch({
      method: "GET",
      path: "/api/transfers/non-existent-id",
      userId,
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Not found" });
  });

  // ── Update ──

  test("PUT /api/transfers/:id updates fields", async () => {
    const { transfer: created } = await api<{ transfer: Record<string, unknown> }>({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer(),
    });

    const { transfer: updated } = await api<{ transfer: Record<string, unknown> }>({
      method: "PUT",
      path: `/api/transfers/${created.id}`,
      userId,
      body: { note: "已修改", outflowAmountCents: 200000 },
    });
    expect(updated.note).toBe("已修改");
    expect(updated.outflowAmountCents).toBe(200000);
  });

  // ── Delete ──

  test("DELETE /api/transfers/:id removes transfer", async () => {
    const { transfer: created } = await api<{ transfer: Record<string, unknown> }>({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer(),
    });

    const res = await api<{ success: boolean }>({
      method: "DELETE",
      path: `/api/transfers/${created.id}`,
      userId,
    });
    expect(res.success).toBe(true);

    const check = await rawFetch({
      method: "GET",
      path: `/api/transfers/${created.id}`,
      userId,
    });
    expect(check.status).toBe(404);
  });

  // ── Search ──

  test("POST /api/transfers/search returns matching transfers", async () => {
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ note: "搜索目标转账" }),
    });
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ note: "不相关" }),
    });

    const res = await api<{ transfers: unknown[]; total_returned: number }>({
      method: "POST",
      path: "/api/transfers/search",
      userId,
      body: { keyword: "搜索目标" },
    });
    expect(res.total_returned).toBe(1);
  });

  test("POST /api/transfers/search with year filter", async () => {
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2025 }),
    });
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2024, date: "2024-03-15" }),
    });

    const res = await api<{ transfers: unknown[]; total_returned: number }>({
      method: "POST",
      path: "/api/transfers/search",
      userId,
      body: { year: 2025 },
    });
    expect(res.total_returned).toBe(1);
  });

  // ── Year-scoped ──

  test("GET /api/transfers/years/:year returns all transfers for year", async () => {
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2025, date: "2025-03-15" }),
    });
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2025, date: "2025-06-01" }),
    });
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2024, date: "2024-01-10" }),
    });

    const res = await api<{ transfers: unknown[]; total_returned: number }>({
      method: "GET",
      path: "/api/transfers/years/2025",
      userId,
    });
    expect(res.total_returned).toBe(2);
    expect(res.transfers).toHaveLength(2);
  });

  test("GET /api/transfers/years/:year returns empty for year with no data", async () => {
    const res = await api<{ transfers: unknown[]; total_returned: number }>({
      method: "GET",
      path: "/api/transfers/years/1999",
      userId,
    });
    expect(res.total_returned).toBe(0);
    expect(res.transfers).toHaveLength(0);
  });

  test("GET /api/transfers/years/:year/count returns count for year", async () => {
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2025, date: "2025-06-15" }),
    });
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2025, date: "2025-08-01" }),
    });
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2024, date: "2024-01-10" }),
    });

    const res = await api<{ count: number }>({
      method: "GET",
      path: "/api/transfers/years/2025/count",
      userId,
    });
    expect(res.count).toBe(2);
  });

  test("GET /api/transfers/years/:year/count returns 0 for empty year", async () => {
    const res = await api<{ count: number }>({
      method: "GET",
      path: "/api/transfers/years/1999/count",
      userId,
    });
    expect(res.count).toBe(0);
  });

  test("DELETE /api/transfers/years/:year deletes all in year", async () => {
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2023, date: "2023-03-15" }),
    });
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2023, date: "2023-07-01" }),
    });
    await api({
      method: "POST",
      path: "/api/transfers",
      userId,
      body: makeTransfer({ year: 2024, date: "2024-01-10" }),
    });

    const res = await api<{ deleted: number }>({
      method: "DELETE",
      path: "/api/transfers/years/2023",
      userId,
    });
    expect(res.deleted).toBe(2);

    // Verify 2024 data is untouched
    const remaining = await api<{ count: number }>({
      method: "GET",
      path: "/api/transfers/years/2024/count",
      userId,
    });
    expect(remaining.count).toBe(1);
  });

  // ── Bulk ──

  test("POST /api/transfers/bulk inserts multiple rows", async () => {
    const rows = [
      makeTransfer({ note: "bulk-1" }),
      makeTransfer({ note: "bulk-2" }),
    ];

    const res = await api<{ inserted: number }>({
      method: "POST",
      path: "/api/transfers/bulk",
      userId,
      body: { rows },
    });
    expect(res.inserted).toBe(2);

    const search = await api<{ total_returned: number }>({
      method: "POST",
      path: "/api/transfers/search",
      userId,
      body: {},
    });
    expect(search.total_returned).toBe(2);
  });
});
