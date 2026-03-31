import { describe, test, expect, beforeEach } from "bun:test";
import { api, rawFetch, TEST_USER_A } from "./helpers/client";
import { cleanupUser } from "./helpers/cleanup";
import { makeTransaction } from "./helpers/seed";

const userId = TEST_USER_A;

describe("E2E: Transactions", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  // ── Create ──

  test("POST /api/transactions creates and returns transaction", async () => {
    const data = makeTransaction();
    const res = await api<{ transaction: Record<string, unknown> }>({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: data,
    });
    expect(res.transaction).toBeDefined();
    expect(res.transaction.id).toBeString();
    expect(res.transaction.amountCents).toBe(3500);
    expect(res.transaction.primaryCategory).toBe("餐饮");
  });

  test("POST /api/transactions returns 201 status", async () => {
    const res = await rawFetch({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction(),
    });
    expect(res.status).toBe(201);
  });

  // ── Read ──

  test("GET /api/transactions/:id returns created transaction", async () => {
    const { transaction: created } = await api<{ transaction: Record<string, unknown> }>({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction(),
    });

    const { transaction } = await api<{ transaction: Record<string, unknown> }>({
      method: "GET",
      path: `/api/transactions/${created.id}`,
      userId,
    });
    expect(transaction.id).toBe(created.id);
    expect(transaction.note).toBe("外卖午餐");
  });

  test("GET /api/transactions/:id returns 404 for non-existent", async () => {
    const res = await rawFetch({
      method: "GET",
      path: "/api/transactions/non-existent-id",
      userId,
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Not found" });
  });

  // ── Update ──

  test("PUT /api/transactions/:id updates fields", async () => {
    const { transaction: created } = await api<{ transaction: Record<string, unknown> }>({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction(),
    });

    const { transaction: updated } = await api<{ transaction: Record<string, unknown> }>({
      method: "PUT",
      path: `/api/transactions/${created.id}`,
      userId,
      body: { note: "已修改备注", amountCents: 9900 },
    });
    expect(updated.note).toBe("已修改备注");
    expect(updated.amountCents).toBe(9900);
  });

  test("PUT /api/transactions/:id returns 404 for non-existent", async () => {
    const res = await rawFetch({
      method: "PUT",
      path: "/api/transactions/non-existent-id",
      userId,
      body: { note: "nope" },
    });
    expect(res.status).toBe(404);
  });

  // ── Delete ──

  test("DELETE /api/transactions/:id removes transaction", async () => {
    const { transaction: created } = await api<{ transaction: Record<string, unknown> }>({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction(),
    });

    const res = await api<{ success: boolean }>({
      method: "DELETE",
      path: `/api/transactions/${created.id}`,
      userId,
    });
    expect(res.success).toBe(true);

    // Verify gone
    const check = await rawFetch({
      method: "GET",
      path: `/api/transactions/${created.id}`,
      userId,
    });
    expect(check.status).toBe(404);
  });

  test("DELETE /api/transactions/:id returns 404 for non-existent", async () => {
    const res = await rawFetch({
      method: "DELETE",
      path: "/api/transactions/non-existent-id",
      userId,
    });
    expect(res.status).toBe(404);
  });

  // ── Search ──

  test("POST /api/transactions/search returns matching transactions", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ note: "搜索目标", primaryCategory: "交通" }),
    });
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ note: "不相关" }),
    });

    const res = await api<{ transactions: unknown[]; total_returned: number }>({
      method: "POST",
      path: "/api/transactions/search",
      userId,
      body: { keyword: "搜索目标" },
    });
    expect(res.total_returned).toBe(1);
    expect(res.transactions).toHaveLength(1);
  });

  test("POST /api/transactions/search with year filter", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ year: 2025, month: 6 }),
    });
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ year: 2024, month: 3, date: "2024-03-15" }),
    });

    const res = await api<{ transactions: unknown[]; total_returned: number }>({
      method: "POST",
      path: "/api/transactions/search",
      userId,
      body: { year: 2025 },
    });
    expect(res.total_returned).toBe(1);
  });

  test("POST /api/transactions/search with type filter", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ type: "income", primaryCategory: "工资" }),
    });
    await api({
      method: "POST",
      path: "/api/transactions",
      userId,
      body: makeTransaction({ type: "expense" }),
    });

    const res = await api<{ transactions: unknown[]; total_returned: number }>({
      method: "POST",
      path: "/api/transactions/search",
      userId,
      body: { type: "income" },
    });
    expect(res.total_returned).toBe(1);
  });

  test("POST /api/transactions/search returns empty for no matches", async () => {
    const res = await api<{ transactions: unknown[]; total_returned: number }>({
      method: "POST",
      path: "/api/transactions/search",
      userId,
      body: {},
    });
    expect(res.total_returned).toBe(0);
    expect(res.transactions).toHaveLength(0);
  });

  // ── Bulk ──

  test("POST /api/transactions/bulk inserts multiple rows", async () => {
    const rows = [
      makeTransaction({ note: "bulk-1" }),
      makeTransaction({ note: "bulk-2" }),
      makeTransaction({ note: "bulk-3" }),
    ];

    const res = await api<{ inserted: number }>({
      method: "POST",
      path: "/api/transactions/bulk",
      userId,
      body: { rows },
    });
    expect(res.inserted).toBe(3);

    // Verify via search
    const search = await api<{ total_returned: number }>({
      method: "POST",
      path: "/api/transactions/search",
      userId,
      body: {},
    });
    expect(search.total_returned).toBe(3);
  });
});
