import { describe, test, expect, beforeEach } from "bun:test";
import { api, TEST_USER_A } from "./helpers/client";
import { cleanupUser } from "./helpers/cleanup";
import { makeTransaction, makeTransfer, makeProduct, makeUnit } from "./helpers/seed";

const userId = TEST_USER_A;

describe("E2E: Data Export / Import", () => {
  beforeEach(async () => {
    await cleanupUser(userId);
  });

  test("GET /api/data/export returns all user data", async () => {
    await api({ method: "POST", path: "/api/transactions", userId, body: makeTransaction() });
    await api({ method: "POST", path: "/api/transfers", userId, body: makeTransfer() });
    await api({ method: "POST", path: "/api/products", userId, body: makeProduct() });
    await api({ method: "POST", path: "/api/units", userId, body: makeUnit() });

    const backup = await api<{
      transactions: unknown[];
      transfers: unknown[];
      products: unknown[];
      units: unknown[];
      exported_at: string;
    }>({
      method: "GET",
      path: "/api/data/export",
      userId,
    });

    expect(backup.transactions).toHaveLength(1);
    expect(backup.transfers).toHaveLength(1);
    expect(backup.products).toHaveLength(1);
    expect(backup.units).toHaveLength(1);
    expect(backup.exported_at).toBeString();
  });

  test("GET /api/data/export returns empty when no data", async () => {
    const backup = await api<{
      transactions: unknown[];
      transfers: unknown[];
    }>({
      method: "GET",
      path: "/api/data/export",
      userId,
    });
    expect(backup.transactions).toHaveLength(0);
    expect(backup.transfers).toHaveLength(0);
  });

  test("POST /api/data/import replaces transactions and transfers", async () => {
    // Seed initial data
    await api({ method: "POST", path: "/api/transactions", userId, body: makeTransaction({ note: "old" }) });
    await api({ method: "POST", path: "/api/transfers", userId, body: makeTransfer({ note: "old" }) });

    // Import with new data
    const restored = await api<{
      transactions_imported: number;
      transfers_imported: number;
    }>({
      method: "POST",
      path: "/api/data/import",
      userId,
      body: {
        transactions: [
          makeTransaction({ note: "restored-1" }),
          makeTransaction({ note: "restored-2" }),
        ],
        transfers: [makeTransfer({ note: "restored-t1" })],
      },
    });
    expect(restored.transactions_imported).toBe(2);
    expect(restored.transfers_imported).toBe(1);

    // Verify old data is gone, new data exists
    const search = await api<{ transactions: Array<Record<string, unknown>> }>({
      method: "POST",
      path: "/api/transactions/search",
      userId,
      body: {},
    });
    expect(search.transactions).toHaveLength(2);
    const notes = search.transactions.map((t) => t.note);
    expect(notes).toContain("restored-1");
    expect(notes).toContain("restored-2");
    expect(notes).not.toContain("old");
  });

  test("GET /api/data/export response has exported_at (structural regression guard)", async () => {
    // The export route uses findAllByUser() which returns exported_at.
    // The search endpoint does NOT return exported_at.
    // If someone regresses export back to search(), this test will fail
    // because the response shape will be missing exported_at.
    await api({ method: "POST", path: "/api/transactions", userId, body: makeTransaction() });

    const res = await api<Record<string, unknown>>({
      method: "GET",
      path: "/api/data/export",
      userId,
    });

    // exported_at must exist and be a valid ISO timestamp
    expect(res.exported_at).toBeDefined();
    expect(typeof res.exported_at).toBe("string");
    expect(new Date(res.exported_at as string).toISOString()).toBe(res.exported_at);

    // search-style response fields must NOT be present
    expect(res.total_returned).toBeUndefined();
    expect(res.total_count).toBeUndefined();
  });

  test("GET /api/data/export returns all rows without truncation", async () => {
    // Seed 10 transactions + 5 transfers.
    // If export regresses to search() with default/clamped limit,
    // it would still pass for small counts, but the structural guard
    // above catches that. This test validates count correctness.
    const txPromises = Array.from({ length: 10 }, (_, i) =>
      api({
        method: "POST",
        path: "/api/transactions",
        userId,
        body: makeTransaction({ note: `export-count-tx-${i}` }),
      }),
    );
    const trPromises = Array.from({ length: 5 }, (_, i) =>
      api({
        method: "POST",
        path: "/api/transfers",
        userId,
        body: makeTransfer({ note: `export-count-tr-${i}` }),
      }),
    );
    await Promise.all([...txPromises, ...trPromises]);

    const backup = await api<{
      transactions: unknown[];
      transfers: unknown[];
      exported_at: string;
    }>({
      method: "GET",
      path: "/api/data/export",
      userId,
    });

    expect(backup.transactions).toHaveLength(10);
    expect(backup.transfers).toHaveLength(5);
    expect(backup.exported_at).toBeString();
  });

  test("POST /api/data/import with empty arrays clears all", async () => {
    await api({ method: "POST", path: "/api/transactions", userId, body: makeTransaction() });

    await api({
      method: "POST",
      path: "/api/data/import",
      userId,
      body: { transactions: [], transfers: [] },
    });

    const search = await api<{ total_returned: number }>({
      method: "POST",
      path: "/api/transactions/search",
      userId,
      body: {},
    });
    expect(search.total_returned).toBe(0);
  });
});
