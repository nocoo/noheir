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
