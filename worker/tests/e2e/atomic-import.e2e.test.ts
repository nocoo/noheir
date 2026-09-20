import { beforeEach, describe, expect, test } from "vitest";
import { cleanupUser } from "./helpers/cleanup";
import { api, rawFetch, TEST_USER_A, TEST_USER_B } from "./helpers/client";
import { makeTransaction, makeTransfer } from "./helpers/seed";

for (const [kind, makeRow] of [
  ["transactions", makeTransaction],
  ["transfers", makeTransfer],
] as const) {
  describe(`${kind} annual replacement`, () => {
    beforeEach(async () => {
      await cleanupUser(TEST_USER_A);
      await cleanupUser(TEST_USER_B);
    });
    test("replaces only the selected year and authenticated owner", async () => {
      await api({ path: `/api/${kind}`, method: "POST", userId: TEST_USER_A, body: makeRow() });
      await api({
        path: `/api/${kind}`,
        method: "POST",
        userId: TEST_USER_A,
        body: makeRow({ year: 2024, date: "2024-06-15" }),
      });
      await api({ path: `/api/${kind}`, method: "POST", userId: TEST_USER_B, body: makeRow() });
      const result = await api<{ imported: number }>({
        path: `/api/${kind}/import`,
        method: "POST",
        userId: TEST_USER_A,
        body: { year: 2025, rows: [makeRow({ note: "replacement" }), makeRow({ note: "second" })] },
      });
      expect(result.imported).toBe(2);
      for (const [owner, year, count] of [
        [TEST_USER_A, 2025, 2],
        [TEST_USER_A, 2024, 1],
        [TEST_USER_B, 2025, 1],
      ] as const) {
        const data = await api<{ count: number }>({
          path: `/api/${kind}/years/${year}/count`,
          userId: owner,
        });
        expect(data.count).toBe(count);
      }
    });
    test("rolls back the delete and earlier chunks when a database write fails", async () => {
      const original = await api<Record<string, { id: string }>>({
        path: `/api/${kind}`,
        method: "POST",
        userId: TEST_USER_A,
        body: makeRow({ note: "survives-database-failure" }),
      });
      const key = kind === "transactions" ? "transaction" : "transfer";
      const rows = Array.from({ length: 1200 }, (_, i) =>
        makeRow({ id: `rollback-${kind}-${i}`, note: "x".repeat(500) }),
      );
      rows.push(makeRow({ note: "test-injected-write-failure" }));
      const response = await rawFetch({
        path: `/api/${kind}/import`,
        method: "POST",
        userId: TEST_USER_A,
        body: { year: 2025, rows },
      });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Internal server error" });
      expect(
        (
          await rawFetch({
            path: `/api/${kind}/${original[key]?.id}`,
            userId: TEST_USER_A,
          })
        ).status,
      ).toBe(200);
      const count = await api<{ count: number }>({
        path: `/api/${kind}/years/2025/count`,
        userId: TEST_USER_A,
      });
      expect(count.count).toBe(1);
    });
    test("validates the entire import before deleting existing data", async () => {
      await api({
        path: `/api/${kind}`,
        method: "POST",
        userId: TEST_USER_A,
        body: makeRow({ note: "keep" }),
      });
      for (const rows of [
        [],
        [makeRow(), makeRow({ year: 2024 })],
        [makeRow(), makeRow({ date: "invalid" })],
      ]) {
        const response = await rawFetch({
          path: `/api/${kind}/import`,
          method: "POST",
          userId: TEST_USER_A,
          body: { year: 2025, rows },
        });
        expect(response.status).toBe(400);
        const data = await api<{ count: number }>({
          path: `/api/${kind}/years/2025/count`,
          userId: TEST_USER_A,
        });
        expect(data.count).toBe(1);
      }
    });
  });
}

describe("Browser financial write ownership", () => {
  test.each(["transactions", "transfers"] as const)(
    "%s cannot be reassigned by JSON fields",
    async (kind) => {
      const body = kind === "transactions" ? makeTransaction() : makeTransfer();
      const key = kind === "transactions" ? "transaction" : "transfer";
      const created = await api<Record<string, { id: string }>>({
        path: `/api/${kind}`,
        method: "POST",
        userId: TEST_USER_A,
        body,
      });
      const id = created[key]?.id;
      expect(id).toBeTypeOf("string");
      for (const body of [
        { year: 2030 },
        { date: "2025-02-30" },
        kind === "transactions" ? { amountCents: 1.5 } : { inflowAmountCents: 1.5 },
      ]) {
        expect(
          (
            await rawFetch({
              path: `/api/${kind}/${id}`,
              method: "PUT",
              userId: TEST_USER_A,
              body,
            })
          ).status,
        ).toBe(400);
      }
      await api({
        path: `/api/${kind}/${id}`,
        method: "PUT",
        userId: TEST_USER_A,
        body: { date: "2024-02-29" },
      });
      const dated = await api<Record<string, unknown>>({
        path: `/api/${kind}/${id}`,
        userId: TEST_USER_A,
      });
      expect(dated[key]).toMatchObject({ date: "2024-02-29", year: 2024, month: 2, day: 29 });
      const update = await rawFetch({
        path: `/api/${kind}/${id}`,
        method: "PUT",
        userId: TEST_USER_A,
        body: { note: "safe update", id: "forged-id", userId: TEST_USER_B, user_id: TEST_USER_B },
      });
      expect([200, 400]).toContain(update.status);
      expect((await rawFetch({ path: `/api/${kind}/${id}`, userId: TEST_USER_A })).status).toBe(
        200,
      );
      expect((await rawFetch({ path: `/api/${kind}/${id}`, userId: TEST_USER_B })).status).toBe(
        404,
      );
      expect((await rawFetch({ path: `/api/${kind}/forged-id`, userId: TEST_USER_B })).status).toBe(
        404,
      );
    },
  );
  test("annual import and JSON restore support existing dataset sizes", async () => {
    await cleanupUser(TEST_USER_A);
    const rows = Array.from({ length: 10_000 }, (_, i) => makeTransaction({ note: `row-${i}` }));
    const imported = await api<{ imported: number }>({
      path: "/api/transactions/import",
      method: "POST",
      userId: TEST_USER_A,
      body: { year: 2025, rows },
    });
    expect(imported.imported).toBe(10_000);
    const backup = await api<Record<string, unknown>>({
      path: "/api/data/export",
      userId: TEST_USER_A,
    });
    await api({ path: "/api/data/import", method: "POST", userId: TEST_USER_A, body: backup });
    const count = await api<{ count: number }>({
      path: "/api/transactions/years/2025/count",
      userId: TEST_USER_A,
    });
    expect(count.count).toBe(10_000);
    await cleanupUser(TEST_USER_A);
  });
});
