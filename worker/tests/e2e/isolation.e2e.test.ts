import { describe, test, expect, beforeEach } from "vitest";
import { api, TEST_USER_A, TEST_USER_B } from "./helpers/client";
import { cleanupUser } from "./helpers/cleanup";
import { makeTransaction, makeTransfer, makeProduct, makeUnit } from "./helpers/seed";

describe("E2E: Cross-user isolation", () => {
  beforeEach(async () => {
    await cleanupUser(TEST_USER_A);
    await cleanupUser(TEST_USER_B);
  });

  test("User B cannot see User A's transactions", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId: TEST_USER_A,
      body: makeTransaction({ note: "A的交易" }),
    });

    const res = await api<{ transactions: unknown[]; total_returned: number }>({
      method: "POST",
      path: "/api/transactions/search",
      userId: TEST_USER_B,
      body: {},
    });
    expect(res.total_returned).toBe(0);
  });

  test("User B cannot see User A's transfers", async () => {
    await api({
      method: "POST",
      path: "/api/transfers",
      userId: TEST_USER_A,
      body: makeTransfer({ note: "A的转账" }),
    });

    const res = await api<{ transfers: unknown[]; total_returned: number }>({
      method: "POST",
      path: "/api/transfers/search",
      userId: TEST_USER_B,
      body: {},
    });
    expect(res.total_returned).toBe(0);
  });

  test("User B cannot see User A's products", async () => {
    await api({
      method: "POST",
      path: "/api/products",
      userId: TEST_USER_A,
      body: makeProduct(),
    });

    const res = await api<{ products: unknown[]; total_returned: number }>({
      method: "GET",
      path: "/api/products",
      userId: TEST_USER_B,
    });
    expect(res.total_returned).toBe(0);
  });

  test("User B cannot see User A's units", async () => {
    await api({
      method: "POST",
      path: "/api/units",
      userId: TEST_USER_A,
      body: makeUnit(),
    });

    const res = await api<{ units: unknown[]; total_returned: number }>({
      method: "GET",
      path: "/api/units",
      userId: TEST_USER_B,
    });
    expect(res.total_returned).toBe(0);
  });

  test("User B cannot see User A's metadata", async () => {
    await api({
      method: "POST",
      path: "/api/transactions",
      userId: TEST_USER_A,
      body: makeTransaction(),
    });

    const res = await api<{ transaction_count: number }>({
      method: "GET",
      path: "/api/reports/metadata",
      userId: TEST_USER_B,
    });
    expect(res.transaction_count).toBe(0);
  });
});
