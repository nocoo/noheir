import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceApiClient, FinanceApiError } from "@/lib/finance-api";

const response = (data: unknown = {}, meta = {}) =>
  new Response(JSON.stringify({ data, meta }), { status: 200 });
afterEach(() => vi.unstubAllGlobals());
describe("human finance API transport", () => {
  it("uses instance-bound human endpoints and never a credential header or cache", async () => {
    const fetch = vi.fn().mockImplementation(async () => response([]));
    vi.stubGlobal("fetch", fetch);
    const client = new FinanceApiClient();
    await client.listKeys();
    await client.createKey({ label: "Reports", scopes: ["analyses:write"], expiresInDays: 90 });
    await client.revokeKey("key /1");
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      "/api/api-keys",
      "/api/api-keys",
      "/api/api-keys/key%20%2F1",
    ]);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: "GET", cache: "no-store" });
    expect(new Headers(fetch.mock.calls[1]?.[1].headers).has("authorization")).toBe(false);
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({
      label: "Reports",
      scopes: ["analyses:write"],
      expiresInDays: 90,
    });
  });
  it("preserves page metadata, filters, versions and empty deletes", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => response([], { nextCursor: "next", dataRevision: 4 }));
    vi.stubGlobal("fetch", fetch);
    const client = new FinanceApiClient();
    expect(
      (await client.listAnalyses(new URLSearchParams({ cursor: "a b", q: "Cash" }))).meta
        .nextCursor,
    ).toBe("next");
    await client.getAnalysis("id");
    await client.createAnalysis({
      title: "Report",
      markdown: "Body",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      currencies: ["CNY"],
      dataRevision: 4,
    });
    await client.updateAnalysis("id", 2, { title: "Edited" });
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await client.deleteAnalysis("id", 3)).toBeUndefined();
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/analyses?cursor=a+b&q=Cash");
    expect(fetch.mock.calls[3]?.[1]).toMatchObject({
      method: "PATCH",
      headers: expect.objectContaining({ "If-Match": '"2"' }),
    });
    expect(fetch.mock.calls[4]?.[1].headers["If-Match"]).toBe('"3"');
  });
  it("atomically replaces typed collections and patches singleton without read-modify-write", async () => {
    const fetch = vi.fn().mockImplementation(async () => response([]));
    vi.stubGlobal("fetch", fetch);
    const client = new FinanceApiClient();
    await client.listAccountClassifications();
    await client.listBalanceAnchors();
    await client.getFinancialPreferences();
    await client.replaceAccountClassifications([{ accountName: "Cash", type: "debit" }], 4);
    await client.replaceBalanceAnchors(
      [{ accountName: "Cash", currency: "CNY", date: "2026-01-01", balanceCents: 123 }],
      5,
    );
    await client.saveFinancialPreferences({ savingsRateTarget: 40 }, 2);
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      "/api/account-classifications",
      "/api/balance-anchors",
      "/api/financial-preferences",
      "/api/account-classifications",
      "/api/balance-anchors",
      "/api/financial-preferences",
    ]);
    expect(JSON.parse(fetch.mock.calls[3]?.[1].body)).toEqual({
      items: [{ accountName: "Cash", type: "debit" }],
    });
    expect(fetch.mock.calls[4]?.[1].headers["If-Match"]).toBe('"5"');
    expect(JSON.parse(fetch.mock.calls[5]?.[1].body)).toEqual({ savingsRateTarget: 40 });
  });
  it.each([
    [
      412,
      { title: "Changed", code: "stale_version", requestId: "r1" },
      "数据版本已变化，请刷新并核对后重新编辑；未自动重试。",
    ],
    [403, { error: "Not permitted" }, "Not permitted"],
    [500, "not json", "Request failed (500)"],
  ])("returns safe errors for status %s", async (status, body, message) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
        ),
    );
    const error = await new FinanceApiClient().listKeys().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(FinanceApiError);
    expect(error).toMatchObject({ status, message });
  });
  it("reads full financial collections before any replace, never a truncated first page", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response([{ accountName: "A", type: "debit" }], {
          dataRevision: 2,
          hasMore: true,
          nextCursor: "next",
        }),
      )
      .mockResolvedValueOnce(
        response([{ accountName: "B", type: "credit" }], { dataRevision: 2, hasMore: false }),
      );
    vi.stubGlobal("fetch", fetch);
    const result = await new FinanceApiClient().listAccountClassifications();
    expect(result.data).toHaveLength(2);
    expect(result.meta.returned).toBe(2);
    expect(fetch.mock.calls[1]?.[0]).toBe("/api/account-classifications?cursor=next");
  });
  it("fails closed on broken or revision-changing collection pagination", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response([], { dataRevision: 1, hasMore: true }))
      .mockResolvedValueOnce(response([], { dataRevision: 1, hasMore: true, nextCursor: "x" }))
      .mockResolvedValueOnce(response([], { dataRevision: 2 }));
    vi.stubGlobal("fetch", fetch);
    const client = new FinanceApiClient();
    await expect(client.listBalanceAnchors()).rejects.toThrow("Incomplete collection response");
    await expect(client.listAccountClassifications()).rejects.toThrow(
      "Financial data changed; reload before saving",
    );
  });
  it("fails closed on repeating pagination cursors", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () =>
        response([], { dataRevision: 1, hasMore: true, nextCursor: "same" }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(new FinanceApiClient().listBalanceAnchors()).rejects.toThrow(
      "Incomplete collection response",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("resets only typed finance with the provided version", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ affected: 1 }));
    vi.stubGlobal("fetch", fetch);
    await new FinanceApiClient().resetFinancialPreferences(0);
    expect(fetch).toHaveBeenCalledWith(
      "/api/financial-preferences",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ "If-Match": '"0"' }),
      }),
    );
  });
  it("rejects invalid versions before making a request and propagates network errors", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("Offline"));
    vi.stubGlobal("fetch", fetch);
    const client = new FinanceApiClient();
    for (const version of [-1, 0.1, Number.NaN])
      await expect(client.deleteAnalysis("id", version)).rejects.toThrow("Invalid version");
    expect(fetch).not.toHaveBeenCalled();
    await expect(client.listKeys()).rejects.toThrow("Offline");
  });
});
