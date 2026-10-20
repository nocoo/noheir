import { beforeEach, describe, expect, test } from "vitest";
import {
  API_SCOPES,
  type ApiEnvelope,
  type ApiMutation,
  type ApiScope,
} from "../../../src/domain/api-contract";
import { cleanupUser } from "./helpers/cleanup";
import { api, BASE_URL, rawFetch, TEST_USER_A, TEST_USER_B } from "./helpers/client";
import { makeProduct } from "./helpers/seed";

async function issue(scopes: readonly ApiScope[] = API_SCOPES, userId = TEST_USER_A) {
  const result = await api<ApiEnvelope<{ id: string; token: string }>>({
    path: "/api/api-keys",
    method: "POST",
    userId,
    body: { label: "Native acceptance", scopes, expiresInDays: 1 },
  });
  return result.data;
}
function request(
  token: string,
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return fetch(`${BASE_URL}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function write(
  token: string,
  path: string,
  body?: unknown,
  method = "POST",
  version?: number,
  key = crypto.randomUUID(),
) {
  return request(token, path, method, body, {
    "Idempotency-Key": key,
    ...(version === undefined ? {} : { "If-Match": `"${version}"` }),
  });
}
async function data<T>(response: Response, status = 200): Promise<ApiEnvelope<T>> {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("x-request-id")).toBeTruthy();
  return response.json();
}
const transaction = (account: string, overrides = {}) => ({
  date: "2026-10-01",
  type: "income",
  primaryCategory: "Salary",
  secondaryCategory: "Work",
  tertiaryCategory: "Monthly",
  amountCents: 100,
  account,
  currency: "CNY",
  tags: ["analysis"],
  ...overrides,
});
const report = (overrides = {}) => ({
  title: "Native report",
  markdown: "# External analysis\n\nNo model call in Noheir.",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  currencies: ["CNY"],
  dataRevision: 0,
  evidence: [],
  ...overrides,
});

beforeEach(async () => {
  await cleanupUser(TEST_USER_A);
  await cleanupUser(TEST_USER_B);
});

describe("Native scoped REST boundary", () => {
  test("known operation paths return 405 with actual methods rather than unknown-path 404", async () => {
    const key = await issue();
    for (const [path, method, allowed] of [
      ["/me", "POST", "GET"],
      ["/units/00000000-0000-0000-0000-000000000000/commit", "GET", "POST"],
      ["/summaries/cash-flow", "POST", "GET"],
      ["/financial-preferences", "POST", "PATCH"],
    ]) {
      const response = await request(key.token, path ?? "", method);
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toContain(allowed);
    }
  });
  test("audit cursors invalidate on finance, report and key events and bind the caller", async () => {
    const key = await issue();
    const other = await issue();
    const path = "/audit-events?limit=1";
    for (const append of [
      () => api({ path: "/api/products", method: "POST", body: makeProduct() }),
      () => write(key.token, "/analyses", report()),
      () => issue(["transactions:read"]),
    ]) {
      const first = await data<unknown[]>(await request(key.token, path));
      expect(first.meta.hasMore).toBe(true);
      const next = `${path}&cursor=${encodeURIComponent(first.meta.nextCursor ?? "")}`;
      expect((await request(other.token, next)).status).toBe(400);
      await append();
      expect((await request(key.token, next)).status).toBe(409);
    }
  });
  test("public discovery is usable, authenticated paths never accept Access as a substitute", async () => {
    const discovery = await fetch(`${BASE_URL}/api/v1/openapi.json`);
    expect(discovery.status).toBe(200);
    const spec = (await discovery.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths).some((path) => path.includes("agent"))).toBe(false);
    for (const path of ["/api/v1/me", "/api/v1/transactions", "/api/v1/query", "/api/v1/execute"]) {
      expect((await rawFetch({ path })).status).toBe(401);
      expect((await rawFetch({ path, headers: { Authorization: "Bearer invalid" } })).status).toBe(
        401,
      );
    }
    const key = await issue();
    for (const path of ["/query", "/execute", "/settings", "/api-keys", "/data/export"])
      expect((await request(key.token, path)).status).toBe(404);
    expect((await request(key.token, "/transactions", "PUT", {})).status).toBe(405);
    for (const path of ["/api/api-keys", "/api/settings"])
      expect(
        (await rawFetch({ path, headers: { Authorization: `Bearer ${key.token}` } })).status,
      ).toBe(401);
  });
  test("a token is shown once, cannot be discovered in export, and revocation blocks replay", async () => {
    const key = await issue();
    const payload = transaction("revocation");
    await data(
      await write(key.token, "/transactions", payload, "POST", undefined, "revoked-replay"),
      201,
    );
    const keys = await api({ path: "/api/api-keys" });
    expect(JSON.stringify(keys)).not.toContain(key.token);
    const backup = await api<Record<string, unknown>>({ path: "/api/data/export" });
    expect(backup).not.toHaveProperty("settings");
    expect(JSON.stringify(backup)).not.toContain(key.token);
    await api({ path: `/api/api-keys/${key.id}`, method: "DELETE" });
    const replay = await write(
      key.token,
      "/transactions",
      payload,
      "POST",
      undefined,
      "revoked-replay",
    );
    expect(replay.status).toBe(401);
    expect(replay.headers.get("www-authenticate")).toContain("Bearer");
  });
  test("write-only grants return minimal receipts and never imply read/delete", async () => {
    const key = await issue(["products:write"]);
    const receipt = await data<ApiMutation>(
      await write(key.token, "/products", makeProduct()),
      201,
    );
    expect(Object.keys(receipt.data).sort()).toEqual(["affected", "id", "version"]);
    expect((await request(key.token, `/products/${receipt.data.id}`)).status).toBe(403);
    expect(
      (await write(key.token, `/products/${receipt.data.id}`, undefined, "DELETE", 1)).status,
    ).toBe(403);
    const foreign = await api<{ product: { id: string } }>({
      path: "/api/products",
      method: "POST",
      userId: TEST_USER_B,
      body: makeProduct(),
    });
    const denied = await write(
      key.token,
      `/products/${foreign.product.id}`,
      { name: "forged" },
      "PATCH",
      1,
    );
    expect(denied.status).toBe(404);
    const reader = await issue(["products:read"]);
    expect((await write(reader.token, "/products", makeProduct())).status).toBe(403);
  });
  test("mutation preconditions are explicit and human/API writes share the same version", async () => {
    const key = await issue();
    expect((await request(key.token, "/products", "POST", makeProduct())).status).toBe(428);
    const created = (
      await data<ApiMutation>(await write(key.token, "/products", makeProduct()), 201)
    ).data;
    expect(
      (await write(key.token, `/products/${created.id}`, { name: "missing" }, "PATCH")).status,
    ).toBe(428);
    const snapshot = await api<{ product: { id: string; version: number } }>({
      path: `/api/products/${created.id}`,
    });
    const updated = (
      await data<ApiMutation>(
        await write(
          key.token,
          `/products/${created.id}`,
          { name: "External" },
          "PATCH",
          snapshot.product.version,
        ),
      )
    ).data;
    expect(updated.version).toBe(snapshot.product.version + 1);
    const stale = await rawFetch({
      path: `/api/products/${created.id}`,
      method: "PUT",
      version: snapshot.product.version,
      body: { name: "Stale browser" },
    });
    expect(stale.status).toBe(412);
    const current = await data<{ name: string }>(
      await request(key.token, `/products/${created.id}`),
    );
    expect(current.data.name).toBe("External");
  });
  test("concurrent identical creates and deletes replay one financial effect", async () => {
    const key = await issue();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        write(key.token, "/products", makeProduct(), "POST", undefined, "same-create"),
      ),
    );
    const receipts = await Promise.all(
      results.map(async (result) => (await data<ApiMutation>(result, 201)).data),
    );
    expect(new Set(receipts.map((item) => item.id)).size).toBe(1);
    const row = receipts[0];
    if (!row) throw new Error("Missing receipt");
    const conflict = await write(
      key.token,
      "/products",
      makeProduct({ name: "different" }),
      "POST",
      undefined,
      "same-create",
    );
    expect(conflict.status).toBe(409);
    const deleted = await Promise.all(
      Array.from({ length: 4 }, () =>
        write(key.token, `/products/${row.id}`, undefined, "DELETE", row.version, "same-delete"),
      ),
    );
    for (const response of deleted)
      expect((await data<ApiMutation>(response)).data.id).toBe(row.id);
    const audit: Array<{ resourceId: string; operation: string }> = [];
    let cursor: string | null | undefined;
    do {
      const page = await data<typeof audit>(
        await request(
          key.token,
          `/audit-events?limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        ),
      );
      audit.push(...page.data);
      expect(Boolean(page.meta.nextCursor)).toBe(page.meta.hasMore);
      cursor = page.meta.nextCursor;
    } while (cursor);
    expect(audit.filter((event) => event.resourceId === row.id)).toHaveLength(2);
  });
});

describe("Native complete financial analysis workflow", () => {
  test("Chinese filters paginate exactly once and revisions invalidate mixed traversals", async () => {
    const key = await issue();
    const account = "中文账户";
    for (let i = 0; i < 3; i++)
      await data(
        await write(key.token, "/transactions", transaction(account, { note: `row${i}` })),
        201,
      );
    const path = `/transactions?account=${encodeURIComponent(account)}&limit=1&total=true`;
    const first = await data<Array<{ id: string }>>(await request(key.token, path));
    expect(first.meta).toMatchObject({ hasMore: true, total: 3 });
    const ids = first.data.map((row) => row.id);
    let cursor = first.meta.nextCursor;
    while (cursor) {
      const page = await data<Array<{ id: string }>>(
        await request(key.token, `${path}&cursor=${encodeURIComponent(cursor)}`),
      );
      ids.push(...page.data.map((row) => row.id));
      cursor = page.meta.nextCursor;
    }
    expect(new Set(ids).size).toBe(3);
    expect(ids).toHaveLength(3);
    expect(
      (
        await request(
          key.token,
          `${path}&currency=USD&cursor=${encodeURIComponent(first.meta.nextCursor ?? "")}`,
        )
      ).status,
    ).toBe(400);
    await data(await write(key.token, "/transactions", transaction(account)), 201);
    expect(
      (
        await request(
          key.token,
          `${path}&cursor=${encodeURIComponent(first.meta.nextCursor ?? "")}`,
        )
      ).status,
    ).toBe(409);
  });
  test("mixed currencies stay separate, browser default is CNY and absent balances stay unknown", async () => {
    const key = await issue();
    for (const currency of ["CNY", "USD"])
      await data(await write(key.token, "/transactions", transaction("Mixed", { currency })), 201);
    const summary = await data<{ transactions: Array<{ currency: string; amountCents: number }> }>(
      await request(key.token, "/summaries/cash-flow?account=Mixed"),
    );
    expect(summary.data.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currency: "CNY", amountCents: 100 }),
        expect.objectContaining({ currency: "USD", amountCents: 100 }),
      ]),
    );
    const browser = await api<{ totals: { income: number } }>({
      path: "/api/reports/yearly-summary?year=2026&currency=CNY",
    });
    expect(browser.totals.income).toBe(100);
    const balances = await data<
      Array<{ status: string; reconstructedBalanceCents: number | null }>
    >(await request(key.token, "/accounts/balances?asOf=2026-10-31&account=Mixed"));
    expect(balances.data).toHaveLength(2);
    for (const balance of balances.data)
      expect(balance).toMatchObject({ status: "unknown", reconstructedBalanceCents: null });
  });
  test("batch validation is all-or-nothing and replacement previews expire after human writes", async () => {
    const key = await issue();
    const bad = await write(key.token, "/transactions/batch", {
      items: [transaction("Batch"), transaction("Batch", { date: "2026-02-31" })],
    });
    expect(bad.status).toBe(400);
    const empty = await data<unknown[]>(await request(key.token, "/transactions?account=Batch"));
    expect(empty.data).toEqual([]);
    const prefs = await data<unknown>(await request(key.token, "/financial-preferences"));
    const payload = {
      year: 2026,
      transactions: [transaction("Replacement")],
      allowEmpty: false,
      expectedDataRevision: prefs.meta.dataRevision,
    };
    const preview = await data<{ digest: string }>(
      await write(key.token, "/ledger-replacements/preview", payload),
    );
    await api({ path: "/api/products", method: "POST", body: makeProduct() });
    expect(
      (await write(key.token, "/ledger-replacements", { ...payload, digest: preview.data.digest }))
        .status,
    ).toBe(412);
    expect(
      (await data<unknown[]>(await request(key.token, "/transactions?account=Replacement"))).data,
    ).toEqual([]);
  });
  test("reports enforce evidence grants/ownership and retain creation identity after deletion", async () => {
    const full = await issue();
    const tx = (
      await data<ApiMutation>(
        await write(full.token, "/transactions", transaction("Evidence")),
        201,
      )
    ).data;
    const limited = await issue(["analyses:write"]);
    const input = report({
      externalId: crypto.randomUUID(),
      evidence: [{ resource: "transactions", ids: [tx.id], dataRevision: 0 }],
    });
    expect((await write(limited.token, "/analyses", input)).status).toBe(403);
    const foreign = await issue(API_SCOPES, TEST_USER_B);
    expect((await write(foreign.token, "/analyses", input)).status).toBe(404);
    const created = (await data<ApiMutation>(await write(full.token, "/analyses", input), 201))
      .data;
    const replay = (await data<ApiMutation>(await write(full.token, "/analyses", input), 201)).data;
    expect(replay).toEqual(created);
    const detail = await data<{ createdBy: { kind: string; keyId: string } }>(
      await request(full.token, `/analyses/${created.id}`),
    );
    expect(detail.data.createdBy).toEqual({ kind: "apiKey", keyId: full.id });
    expect(
      (
        await write(
          full.token,
          `/analyses/${created.id}`,
          { externalId: "changed" },
          "PATCH",
          created.version,
        )
      ).status,
    ).toBe(400);
    await data(
      await write(full.token, `/analyses/${created.id}`, undefined, "DELETE", created.version),
    );
    expect(
      (await data<ApiMutation>(await write(full.token, "/analyses", input), 201)).data,
    ).toEqual(created);
    expect((await request(full.token, `/analyses/${created.id}`)).status).toBe(404);
  });
});
