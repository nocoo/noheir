import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkerDbClient } from "@/lib/worker-db-client";

afterEach(() => vi.unstubAllGlobals());
describe("browser mutation snapshot preconditions", () => {
  it("sends the supplied version without an implicit latest read", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    const client = new WorkerDbClient();
    await client.updateProduct("p1", { name: "Edited" }, 3);
    await client.deleteProduct("p1", 3);
    await client.updateUnit("u1", { note: "Edited" }, 4);
    await client.deleteUnit("u1", 4);
    await client.updateContributionLog("l1", { pnlCents: 100 }, 5);
    await client.deleteContributionLog("l1", 5);
    await client.restoreContributionLog("l1", 6);
    await client.updateExpenseCategory("c1", { name: "Edited" }, 7);
    await client.deleteExpenseCategory("c1", 7);
    await client.updateRecurringExpense("r1", { name: "Edited" }, 8);
    await client.deleteRecurringExpense("r1", 8);
    await client.transitionRecurringExpense("r1", "pause", 8);
    await client.updateTransaction("t1", { note: "Edited" }, 9);
    await client.deleteTransaction("t1", 9);
    await client.updateTransfer("t2", { note: "Edited" }, 10);
    await client.deleteTransfer("t2", 10);
    await client.commitUnit("u1", { expected: { productId: null } as never }, 11);
    expect(fetch).toHaveBeenCalledTimes(17);
    expect(fetch.mock.calls.every(([, init]) => init.method !== "GET")).toBe(true);
    expect(fetch.mock.calls.map(([, init]) => new Headers(init.headers).get("If-Match"))).toEqual(
      [3, 3, 4, 4, 5, 5, 6, 7, 7, 8, 8, 8, 9, 9, 10, 10, 11].map((version) => `"${version}"`),
    );
    expect(JSON.parse(fetch.mock.calls[16]?.[1].body).expected).toEqual({ productId: null });
  });
  it("binds all browser summary requests to a single explicit currency", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const client = new WorkerDbClient();
    await client.getYearlySummary(2026);
    await client.getAccountSummary(2026);
    await client.getCategorySummary(2026);
    await client.getFlowSummary(2026);
    await client.getMonthlyReport(2026, 1);
    expect(
      fetch.mock.calls.every(
        ([path]) => new URL(path, "https://example.test").searchParams.get("currency") === "CNY",
      ),
    ).toBe(true);
    await client.getYearlySummary(2026, "USD");
    expect(fetch.mock.calls[5]?.[0]).toContain("currency=USD");
  });
  it("fails closed without a valid snapshot and surfaces 412 rather than retrying", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ title: "stale version", code: "stale_version" }), {
        status: 412,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const client = new WorkerDbClient();
    for (const version of [undefined, -1, Number.NaN, 1.2])
      await expect(client.deleteProduct("p1", version as number)).rejects.toThrow("版本");
    expect(fetch).not.toHaveBeenCalled();
    await expect(client.deleteProduct("p1", 3)).rejects.toThrow("刷新并核对");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
