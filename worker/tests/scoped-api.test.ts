import { readdirSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import workerApp, { type AppEnv } from "../src/index";
import { createHumanApi, createMachineApi } from "../src/scoped-api";

let sqlite: Database.Database;
let app: Hono<AppEnv>;
let d1: D1Database;
const env = { SITE_URL: "https://noheir.test", DB: undefined as unknown as D1Database };
function statement(sql: string, values: unknown[] = []): D1PreparedStatement {
  const execute = () => {
    const stmt = sqlite.prepare(sql);
    const results = stmt.reader ? stmt.all(...values) : [];
    const changes = stmt.reader ? 0 : stmt.run(...values).changes;
    return { success: true, results, meta: { changes } };
  };
  return {
    bind: (...params: unknown[]) => statement(sql, params),
    all: async () => execute(),
    run: async () => execute(),
    first: async (column?: string) => {
      const row = sqlite.prepare(sql).get(...values) as Record<string, unknown> | undefined;
      return (column ? row?.[column] : row) ?? null;
    },
    raw: async () =>
      sqlite
        .prepare(sql)
        .raw()
        .all(...values),
    _execute: execute,
    _sql: sql,
  } as unknown as D1PreparedStatement;
}
function request(path: string, method = "GET", body?: unknown, token?: string, headers = {}) {
  return app.request(
    `https://noheir.test${path}`,
    {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
}
async function key(scopes: string[], days = 90) {
  const response = await request("/api/api-keys", "POST", {
    label: "Test",
    scopes,
    expiresInDays: days,
  });
  expect(response.status).toBe(201);
  return (await response.json()).data as { id: string; token: string };
}
const tx = {
  date: "2026-10-01",
  type: "expense",
  primaryCategory: "Food",
  tertiaryCategory: "Meals",
  amountCents: -1234,
  account: "Bank",
  currency: "CNY",
  tags: ["a", "a%b"],
};
beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const directory = new URL("../db/migrations/", import.meta.url);
  for (const name of readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(new URL(name, directory), "utf8"));
  }
  sqlite.exec(
    "INSERT INTO users(id,email,provider_account_id) VALUES('owner','owner@test','google-owner'),('other','other@test','google-other')",
  );
  d1 = {
    prepare: statement,
    batch: async (statements: D1PreparedStatement[]) =>
      sqlite.transaction(() =>
        statements.map((s) => (s as unknown as { _execute: () => unknown })._execute()),
      )(),
  } as D1Database;
  env.DB = d1;
  app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("d1", d1);
    c.set("userId", "owner");
    return next();
  });
  app.route("/api/v1", createMachineApi());
  app.route("/api", createHumanApi());
});
afterEach(() => sqlite.close());
describe("scoped API key boundary", () => {
  test("shows a high-entropy token once and stores only its digest", async () => {
    const issued = await key(["transactions:read"]);
    expect(issued.token).toMatch(/^nhk_[A-Za-z0-9_-]{43}$/);
    const stored = sqlite.prepare("SELECT * FROM api_keys").get() as Record<string, unknown>;
    expect(JSON.stringify(stored)).not.toContain(issued.token);
    const list = await request("/api/api-keys");
    expect(JSON.stringify(await list.json())).not.toContain(issued.token);
    expect((await request("/api/v1/me", "GET", undefined, issued.token)).status).toBe(200);
  });
  test("rejects empty, duplicate, unknown and administrative grants", async () => {
    for (const scopes of [
      [],
      ["*"],
      ["settings:read"],
      ["keys:write"],
      ["transactions:read", "transactions:read"],
    ]) {
      expect((await request("/api/api-keys", "POST", { label: "Bad", scopes })).status).toBe(400);
    }
    expect(
      (
        await request("/api/api-keys", "POST", {
          label: "Bad",
          scopes: ["transactions:read"],
          expiresInDays: 366,
        })
      ).status,
    ).toBe(400);
  });
  test("rejects missing, expired, revoked, malformed and corrupted stored grants", async () => {
    expect((await request("/api/v1/transactions")).status).toBe(401);
    expect((await request("/api/v1/transactions", "GET", undefined, "nhk_invalid")).status).toBe(
      401,
    );
    const issued = await key(["transactions:read"]);
    sqlite.prepare("UPDATE api_keys SET expires_at = 0 WHERE id = ?").run(issued.id);
    expect((await request("/api/v1/me", "GET", undefined, issued.token)).status).toBe(401);
    sqlite
      .prepare("UPDATE api_keys SET expires_at = ?, scopes = ? WHERE id = ?")
      .run(Date.now() + 86400000, '["admin"]', issued.id);
    expect((await request("/api/v1/me", "GET", undefined, issued.token)).status).toBe(401);
    await request(`/api/api-keys/${issued.id}`, "DELETE");
    expect((await request("/api/v1/me", "GET", undefined, issued.token)).status).toBe(401);
  });
});
describe("financial writes and complete reads", () => {
  test("write does not grant read, delete or administrative access", async () => {
    const issued = await key(["transactions:write"]);
    const response = await request("/api/v1/transactions", "POST", tx, issued.token, {
      "Idempotency-Key": "write-1",
    });
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(Object.keys(result.data).sort()).toEqual(["affected", "id", "version"]);
    expect((await request("/api/v1/transactions", "GET", undefined, issued.token)).status).toBe(
      403,
    );
    expect(
      (
        await request(`/api/v1/transactions/${result.data.id}`, "DELETE", undefined, issued.token, {
          "Idempotency-Key": "delete-1",
          "If-Match": '"1"',
        })
      ).status,
    ).toBe(403);
    expect((await request("/api/v1/api-keys", "GET", undefined, issued.token)).status).toBe(404);
    expect((await request("/api/v1/settings", "GET", undefined, issued.token)).status).toBe(404);
  });
  test("idempotent concurrent retries make exactly one effect, revision and audit", async () => {
    const issued = await key(["transactions:write", "transactions:read"]);
    const responses = await Promise.all(
      [1, 2].map(() =>
        request("/api/v1/transactions", "POST", tx, issued.token, { "Idempotency-Key": "retry" }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    const receipts = await Promise.all(responses.map((response) => response.json()));
    expect(receipts.at(0)?.data).toEqual(receipts.at(1)?.data);
    expect(sqlite.prepare("SELECT count(*) n FROM transactions").get()).toEqual({ n: 1 });
    expect(
      sqlite.prepare("SELECT revision FROM owner_revisions WHERE owner_id='owner'").get(),
    ).toEqual({ revision: 1 });
    expect(
      sqlite.prepare("SELECT count(*) n FROM api_audit WHERE resource='transactions'").get(),
    ).toEqual({ n: 1 });
    expect(
      (
        await request("/api/v1/transactions", "POST", { ...tx, amountCents: 12 }, issued.token, {
          "Idempotency-Key": "retry",
        })
      ).status,
    ).toBe(409);
  });
  test("rejects spoofed ownership, unsafe cents, invalid calendars and unknown fields", async () => {
    const issued = await key(["transactions:write"]);
    for (const body of [
      { ...tx, userId: "other" },
      { ...tx, date: "2026-02-31" },
      { ...tx, amountCents: Number.MAX_SAFE_INTEGER + 1 },
      { ...tx, currency: "人民币" },
      { ...tx, tags: "[]" },
    ]) {
      expect(
        (
          await request("/api/v1/transactions", "POST", body, issued.token, {
            "Idempotency-Key": crypto.randomUUID(),
          })
        ).status,
      ).toBe(400);
    }
    expect((await request("/api/v1/transactions", "POST", tx, issued.token)).status).toBe(428);
  });
  test("checks If-Match in SQL, replays before stale checks and hides other owners", async () => {
    const issued = await key(["transactions:read", "transactions:write"]);
    const created = (
      await (
        await request("/api/v1/transactions", "POST", tx, issued.token, {
          "Idempotency-Key": "create",
        })
      ).json()
    ).data;
    const path = `/api/v1/transactions/${created.id}`;
    expect(
      (
        await request(path, "PATCH", { note: "new" }, issued.token, {
          "Idempotency-Key": "missing",
        })
      ).status,
    ).toBe(428);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await request(path, "PATCH", { note: "new" }, issued.token, {
            "Idempotency-Key": "update",
            "If-Match": '"1"',
          })
        ).status,
      ).toBe(200);
    expect(
      (
        await request(path, "PATCH", { note: "stale" }, issued.token, {
          "Idempotency-Key": "stale",
          "If-Match": '"1"',
        })
      ).status,
    ).toBe(412);
    sqlite.prepare("UPDATE transactions SET user_id='other' WHERE id=?").run(created.id);
    expect((await request(path, "GET", undefined, issued.token)).status).toBe(404);
  });
  test("paginates without truncation, exact tags, currency-safe aggregates and revision checking", async () => {
    const issued = await key(["transactions:read", "transactions:write"]);
    for (let i = 0; i < 3; i++)
      await request(
        "/api/v1/transactions",
        "POST",
        { ...tx, currency: i === 2 ? "USD" : "CNY" },
        issued.token,
        { "Idempotency-Key": `row-${i}` },
      );
    const first = await (
      await request("/api/v1/transactions?limit=2&total=true", "GET", undefined, issued.token)
    ).json();
    expect(first.data).toHaveLength(2);
    expect(first.meta.total).toBe(3);
    expect(first.meta.hasMore).toBe(true);
    const second = await (
      await request(
        `/api/v1/transactions?limit=2&total=true&cursor=${encodeURIComponent(first.meta.nextCursor)}`,
        "GET",
        undefined,
        issued.token,
      )
    ).json();
    expect(second.data).toHaveLength(1);
    expect(
      (
        await (
          await request("/api/v1/transactions?tag=a%25b", "GET", undefined, issued.token)
        ).json()
      ).data,
    ).toHaveLength(3);
    const aggregate = await (
      await request("/api/v1/transactions/aggregate", "GET", undefined, issued.token)
    ).json();
    expect(aggregate.data.map((r: { currency: string }) => r.currency).sort()).toEqual([
      "CNY",
      "USD",
    ]);
    await request("/api/v1/transactions", "POST", tx, issued.token, {
      "Idempotency-Key": "changed",
    });
    expect(
      (
        await request(
          `/api/v1/transactions?limit=2&total=true&cursor=${encodeURIComponent(first.meta.nextCursor)}`,
          "GET",
          undefined,
          issued.token,
        )
      ).status,
    ).toBe(409);
  });
});
describe("typed finance resources and reports", () => {
  test("whole collection replacement validates first, preserves versions and rejects stale collections", async () => {
    const initial = await (await request("/api/account-classifications")).json();
    const save = await request(
      "/api/account-classifications",
      "PUT",
      { items: [{ accountName: "Bank", type: "debit" }] },
      undefined,
      { "If-Match": `"${initial.meta.dataRevision}"` },
    );
    expect(save.status).toBe(200);
    const list = await (await request("/api/account-classifications")).json();
    const first = list.data[0];
    expect(
      (
        await request(
          "/api/account-classifications",
          "PUT",
          {
            items: [
              { accountName: "Bank", type: "credit" },
              { accountName: "", type: "debit" },
            ],
          },
          undefined,
          { "If-Match": `"${list.meta.dataRevision}"` },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "/api/account-classifications",
          "PUT",
          { items: [{ accountName: "Bank", type: "credit" }] },
          undefined,
          { "If-Match": `"${list.meta.dataRevision}"` },
        )
      ).status,
    ).toBe(200);
    const second = (await (await request("/api/account-classifications")).json()).data[0];
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(first.version + 1);
    expect(
      (
        await request("/api/account-classifications", "PUT", { items: [] }, undefined, {
          "If-Match": `"${list.meta.dataRevision}"`,
        })
      ).status,
    ).toBe(412);
  });
  test("reports carry periods/currencies and unverified labels with isolated collection revision", async () => {
    const issued = await key(["analyses:read", "analyses:write", "financial-preferences:read"]);
    const input = {
      title: "October",
      markdown: "# Private report",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      currencies: ["CNY"],
      dataRevision: 0,
      externalId: "oct-2026",
      evidence: [],
      author: "External writer",
      model: "Unverified label",
    };
    const created = await request("/api/v1/analyses", "POST", input, issued.token, {
      "Idempotency-Key": "report",
    });
    expect(created.status).toBe(201);
    expect(
      (
        await (
          await request("/api/v1/financial-preferences", "GET", undefined, issued.token)
        ).json()
      ).meta.dataRevision,
    ).toBe(0);
    const list = await (
      await request(
        "/api/v1/analyses?currency=CNY&startDate=2026-10-15&endDate=2026-11-01&q=October",
        "GET",
        undefined,
        issued.token,
      )
    ).json();
    expect(list.data).toHaveLength(1);
    expect(list.meta.dataRevision).toBe(1);
    expect(list.data[0].createdBy).toEqual({ kind: "apiKey", keyId: issued.id });
    expect(
      (
        await request(
          "/api/v1/analyses",
          "POST",
          { ...input, periodEnd: "2026-09-30" },
          issued.token,
          { "Idempotency-Key": "bad-period" },
        )
      ).status,
    ).toBe(400);
  });
  test("missing anchors stay unknown and independent currencies never collapse", async () => {
    const issued = await key([
      "transactions:write",
      "transactions:read",
      "transfers:read",
      "account-classifications:read",
      "balance-anchors:read",
    ]);
    await request("/api/v1/transactions", "POST", tx, issued.token, { "Idempotency-Key": "tx" });
    const balances = await (
      await request("/api/v1/accounts/balances?asOf=2026-10-31", "GET", undefined, issued.token)
    ).json();
    expect(balances.data[0].reconstructedBalanceCents).toBeNull();
    expect(balances.data[0].status).toBe("unknown");
  });
  test("replacement requires every affected scope and exactly matched preview", async () => {
    const issued = await key([
      "data:replace",
      "transactions:read",
      "transactions:write",
      "transactions:delete",
    ]);
    const payload = { year: 2026, transactions: [tx], expectedDataRevision: 0 };
    const preview = await request(
      "/api/v1/ledger-replacements/preview",
      "POST",
      payload,
      issued.token,
    );
    expect(preview.status).toBe(200);
    const digest = (await preview.json()).data.digest;
    expect(
      (
        await request("/api/v1/ledger-replacements", "POST", { ...payload, digest }, issued.token, {
          "Idempotency-Key": "replace",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("/api/v1/ledger-replacements", "POST", { ...payload, digest }, issued.token, {
          "Idempotency-Key": "different",
        })
      ).status,
    ).toBe(412);
    expect(
      (
        await request(
          "/api/v1/ledger-replacements/preview",
          "POST",
          { ...payload, transfers: [] },
          issued.token,
        )
      ).status,
    ).toBe(403);
  });
});
test("migration preserves existing financial settings and rejects ambiguous anchors", () => {
  const historical = new Database(":memory:");
  const directory = new URL("../db/migrations/", import.meta.url);
  for (const name of readdirSync(directory)
    .filter((n) => n.endsWith(".sql") && !n.startsWith("0011"))
    .sort())
    historical.exec(readFileSync(new URL(name, directory), "utf8"));
  historical.exec(
    "INSERT INTO users(id,email,provider_account_id) VALUES('old','old@test','old-google')",
  );
  historical
    .prepare(
      "INSERT INTO transactions(id,user_id,date,year,month,day,primary_category,tertiary_category,amount_cents,type,account,currency) VALUES('tx','old','2026-01-01',2026,1,1,'Salary','Work',100,'income','Bank','人民币')",
    )
    .run();
  historical.prepare("INSERT INTO settings(owner_id,settings) VALUES('old',?)").run(
    JSON.stringify({
      site_theme: "dark",
      ai_config: { apiKey: "discard" },
      account_types: [{ accountName: "Bank", type: "debit" }],
      balance_anchors: [{ accountName: "Bank", date: "2026-01-01", balance: 123.45 }],
      savings_rate_target: 42,
      expected_return_rate: 5,
      min_return_rate: 2,
      max_return_rate: 9,
      active_income_categories: ["Work"],
      fixed_expense_categories: ["Rent"],
    }),
  );
  historical.exec(readFileSync(new URL("0011_scoped_api.sql", directory), "utf8"));
  expect(
    historical
      .prepare("SELECT savings_rate_target FROM financial_preferences WHERE user_id='old'")
      .get(),
  ).toEqual({ savings_rate_target: 42 });
  expect(historical.prepare("SELECT balance_cents,currency FROM balance_anchors").get()).toEqual({
    balance_cents: 12345,
    currency: "CNY",
  });
  expect(historical.prepare("SELECT account_name,type FROM account_classifications").get()).toEqual(
    { account_name: "Bank", type: "debit" },
  );
  const settings = historical.prepare("SELECT settings FROM settings").get() as {
    settings: string;
  };
  expect(JSON.parse(settings.settings)).toEqual({ site_theme: "dark" });
  historical.close();
});
describe("mutation edge cases", () => {
  test("patch does not apply create defaults or erase unrelated fields", async () => {
    const issued = await key(["transactions:write", "transactions:read"]);
    const created = (
      await (
        await request("/api/v1/transactions", "POST", tx, issued.token, {
          "Idempotency-Key": "defaults-create",
        })
      ).json()
    ).data;
    expect(
      (
        await request(
          `/api/v1/transactions/${created.id}`,
          "PATCH",
          { note: "only note" },
          issued.token,
          { "Idempotency-Key": "defaults-patch", "If-Match": '"1"' },
        )
      ).status,
    ).toBe(200);
    const row = (
      await (
        await request(`/api/v1/transactions/${created.id}`, "GET", undefined, issued.token)
      ).json()
    ).data;
    expect(row.tags).toEqual(tx.tags);
  });
  test("report partial updates validate the merged period and keep creation provenance", async () => {
    const issued = await key(["analyses:write", "analyses:read"]);
    const report = {
      title: "Before",
      markdown: "Text",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      currencies: ["CNY"],
      dataRevision: 0,
      evidence: [],
    };
    const created = (
      await (
        await request("/api/v1/analyses", "POST", report, issued.token, {
          "Idempotency-Key": "rp-create",
        })
      ).json()
    ).data;
    const response = await request(
      `/api/v1/analyses/${created.id}`,
      "PATCH",
      { title: "After" },
      issued.token,
      { "Idempotency-Key": "rp-patch", "If-Match": '"1"' },
    );
    expect(response.status).toBe(200);
    expect(
      (
        await request(
          `/api/v1/analyses/${created.id}`,
          "PATCH",
          { periodEnd: "2026-09-01" },
          issued.token,
          { "Idempotency-Key": "rp-invalid", "If-Match": '"2"' },
        )
      ).status,
    ).toBe(400);
    const row = (
      await (await request(`/api/v1/analyses/${created.id}`, "GET", undefined, issued.token)).json()
    ).data;
    expect(row.createdBy.keyId).toBe(issued.id);
    expect(row.title).toBe("After");
  });
  test("unit domain creation derives archive dates and writes investment logs atomically", async () => {
    const issued = await key([
      "products:write",
      "units:write",
      "units:read",
      "contribution-logs:read",
    ]);
    const product = (
      await (
        await request("/api/v1/products", "POST", { name: "Fund", currency: "CNY" }, issued.token, {
          "Idempotency-Key": "unit-product",
        })
      ).json()
    ).data;
    const unit = {
      unitCode: "U1",
      amountCents: 10000,
      currency: "CNY",
      status: "已成立",
      strategy: "长期理财",
      tactics: "债券基金",
      productId: product.id,
      startDate: "2026-10-01",
      endDate: "2027-10-01",
    };
    const response = await request("/api/v1/units", "POST", unit, issued.token, {
      "Idempotency-Key": "unit-create",
    });
    expect(response.status).toBe(201);
    const created = (await response.json()).data;
    const row = (
      await (await request(`/api/v1/units/${created.id}`, "GET", undefined, issued.token)).json()
    ).data;
    expect(row.endDate).toBeNull();
    const logs = (
      await (await request("/api/v1/contribution-logs", "GET", undefined, issued.token)).json()
    ).data;
    expect(logs).toHaveLength(1);
    expect(logs[0].operationDate).toBe("2026-10-01");
  });
});
test("CJK cursors traverse complete matching collections", async () => {
  const issued = await key(["transactions:read", "transactions:write"]);
  for (let i = 0; i < 2; i++)
    await request(
      "/api/v1/transactions",
      "POST",
      { ...tx, account: "招商银行", tags: ["餐饮"] },
      issued.token,
      { "Idempotency-Key": `cjk-${i}` },
    );
  const path =
    "/api/v1/transactions?limit=1&account=" +
    encodeURIComponent("招商银行") +
    "&tag=" +
    encodeURIComponent("餐饮");
  const response = await request(path, "GET", undefined, issued.token);
  expect(response.status).toBe(200);
  const first = await response.json();
  const second = await request(
    `${path}&cursor=${encodeURIComponent(first.meta.nextCursor)}`,
    "GET",
    undefined,
    issued.token,
  );
  expect(second.status).toBe(200);
  expect((await second.json()).data).toHaveLength(1);
});
test("unit swap requires the target snapshot in the atomic mutation guard", async () => {
  const issued = await key([
    "units:read",
    "units:write",
    "units:commit",
    "products:read",
    "contribution-logs:read",
  ]);
  const create = async (code: string) =>
    (
      await (
        await request(
          "/api/v1/units",
          "POST",
          {
            unitCode: code,
            amountCents: 10000,
            currency: "CNY",
            status: "计划中",
            strategy: "长期理财",
            tactics: "债券基金",
          },
          issued.token,
          { "Idempotency-Key": code },
        )
      ).json()
    ).data;
  const a = await create("A"),
    b = await create("B");
  const preflight = (
    await (await request(`/api/v1/units/${a.id}/preflight`, "GET", undefined, issued.token)).json()
  ).data;
  const originalBatch = d1.batch.bind(d1);
  let changed = false;
  d1.batch = (async (statements: D1PreparedStatement[]) => {
    if (
      !changed &&
      statements.some((s) =>
        (s as unknown as { _sql: string })._sql.includes("INSERT INTO api_mutation_context"),
      )
    ) {
      changed = true;
      sqlite.prepare("UPDATE capital_units SET unit_code='changed' WHERE id=?").run(b.id);
    }
    return originalBatch(statements);
  }) as typeof d1.batch;
  const response = await request(
    `/api/v1/units/${a.id}/commit`,
    "POST",
    { expected: preflight.expected, operations: [{ kind: "swap_unit_code", targetUnitId: b.id }] },
    issued.token,
    { "Idempotency-Key": "swap-race", "If-Match": '"1"' },
  );
  expect(response.status).toBe(412);
  expect(
    sqlite.prepare("SELECT count(*) n FROM api_idempotency WHERE value='swap-race'").get(),
  ).toEqual({ n: 0 });
  expect(sqlite.prepare("SELECT unit_code FROM capital_units WHERE id=?").get(a.id)).toEqual({
    unit_code: "A",
  });
});
test("report external identifiers retain the original creation receipt after edits and deletion", async () => {
  const issued = await key(["analyses:read", "analyses:write", "analyses:delete"]);
  const input = {
    title: "Original",
    markdown: "Text",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    currencies: ["CNY"],
    dataRevision: 0,
    externalId: "permanent",
    evidence: [],
  };
  const first = await request("/api/v1/analyses", "POST", input, issued.token, {
    "Idempotency-Key": "external-1",
  });
  expect(first.status).toBe(201);
  const receipt = (await first.json()).data;
  const retry = await request("/api/v1/analyses", "POST", input, issued.token, {
    "Idempotency-Key": "external-2",
  });
  expect(retry.status).toBe(201);
  expect((await retry.json()).data).toEqual(receipt);
  await request(`/api/v1/analyses/${receipt.id}`, "PATCH", { title: "Edited" }, issued.token, {
    "Idempotency-Key": "external-edit",
    "If-Match": '"1"',
  });
  await request(`/api/v1/analyses/${receipt.id}`, "DELETE", undefined, issued.token, {
    "Idempotency-Key": "external-delete",
    "If-Match": '"2"',
  });
  expect(
    (
      await request("/api/v1/analyses", "POST", { ...input, title: "Different" }, issued.token, {
        "Idempotency-Key": "external-changed",
      })
    ).status,
  ).toBe(409);
  const afterDelete = await request("/api/v1/analyses", "POST", input, issued.token, {
    "Idempotency-Key": "external-3",
  });
  expect(afterDelete.status).toBe(201);
  expect((await afterDelete.json()).data).toEqual(receipt);
  expect(sqlite.prepare("SELECT count(*) n FROM analyses").get()).toEqual({ n: 0 });
});

describe("final least-privilege hardening", () => {
  const report = {
    title: "Evidence",
    markdown: "Text",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    currencies: ["CNY"],
    dataRevision: 0,
    evidence: [],
  };
  test("analysis externalId cannot be changed or attached after creation", async () => {
    const issued = await key(["analyses:write"]);
    for (const externalId of [null, "original"]) {
      const created = (
        await (
          await request("/api/v1/analyses", "POST", { ...report, externalId }, issued.token, {
            "Idempotency-Key": crypto.randomUUID(),
          })
        ).json()
      ).data;
      expect(
        (
          await request(
            `/api/v1/analyses/${created.id}`,
            "PATCH",
            { externalId: "new" },
            issued.token,
            { "If-Match": '"1"', "Idempotency-Key": crypto.randomUUID() },
          )
        ).status,
      ).toBe(400);
    }
  });
  test("analysis evidence requires source read grants and owned references on create and patch", async () => {
    const writer = await key(["analyses:write"]),
      reader = await key(["analyses:write", "transactions:read"]);
    const evidence = [{ resource: "transactions", ids: ["foreign"], dataRevision: 0 }];
    expect(
      (
        await request("/api/v1/analyses", "POST", { ...report, evidence }, writer.token, {
          "Idempotency-Key": "no-source-read",
        })
      ).status,
    ).toBe(403);
    const creator = await key(["transactions:write"]);
    const row = (
      await (
        await request("/api/v1/transactions", "POST", tx, creator.token, {
          "Idempotency-Key": "evidence-tx",
        })
      ).json()
    ).data;
    for (const id of [row.id, "absent"]) {
      if (id === row.id)
        sqlite.prepare("UPDATE transactions SET user_id='other' WHERE id=?").run(id);
      expect(
        (
          await request(
            "/api/v1/analyses",
            "POST",
            { ...report, evidence: [{ ...evidence[0], ids: [id] }] },
            reader.token,
            { "Idempotency-Key": crypto.randomUUID() },
          )
        ).status,
      ).toBe(404);
    }
    const created = (
      await (
        await request("/api/v1/analyses", "POST", report, reader.token, {
          "Idempotency-Key": "evidence-report",
        })
      ).json()
    ).data;
    expect(
      (
        await request(`/api/v1/analyses/${created.id}`, "PATCH", { evidence }, reader.token, {
          "If-Match": '"1"',
          "Idempotency-Key": "evidence-patch",
        })
      ).status,
    ).toBe(404);
    sqlite.prepare("UPDATE transactions SET user_id='owner' WHERE id=?").run(row.id);
    expect(
      (
        await request(
          `/api/v1/analyses/${created.id}`,
          "PATCH",
          { evidence: [{ resource: "transactions", ids: [row.id], dataRevision: 0 }] },
          reader.token,
          { "If-Match": '"1"', "Idempotency-Key": "evidence-valid" },
        )
      ).status,
    ).toBe(200);
  });
  test("machine unit patch rejects commit-only fields without comparing secret values", async () => {
    const issued = await key(["units:write"]);
    const row = (
      await (
        await request(
          "/api/v1/units",
          "POST",
          {
            unitCode: "secret",
            amountCents: 100,
            currency: "CNY",
            status: "计划中",
            strategy: "长期理财",
            tactics: "债券基金",
          },
          issued.token,
          { "Idempotency-Key": "secret-unit" },
        )
      ).json()
    ).data;
    for (const amountCents of [100, 101]) {
      const response = await request(
        `/api/v1/units/${row.id}`,
        "PATCH",
        { amountCents },
        issued.token,
        { "If-Match": '"0"', "Idempotency-Key": crypto.randomUUID() },
      );
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("unit_commit_required");
    }
  });
  test("durable fixed-window budgets apply across keys and requests with bounded last-use writes", async () => {
    const issued = await key(["transactions:read"]);
    for (let i = 0; i < 120; i++)
      expect((await request("/api/v1/me", "GET", undefined, issued.token)).status).toBe(200);
    const denied = await request("/api/v1/me", "GET", undefined, issued.token);
    expect(denied.status).toBe(429);
    expect(denied.headers.get("Retry-After")).toBeTruthy();
    const other = await key(["transactions:read"]);
    const window = Math.floor(Date.now() / 60000) * 60000;
    sqlite
      .prepare(
        "UPDATE api_rate_limits SET count=600 WHERE subject=? AND budget='requests' AND window_start=?",
      )
      .run("owner:owner", window);
    expect((await request("/api/v1/me", "GET", undefined, other.token)).status).toBe(429);
    sqlite.prepare("UPDATE api_rate_limits SET window_start=window_start-60000").run();
    for (let i = 0; i < 20; i++)
      expect(
        (await request("/api/v1/transactions/aggregate", "GET", undefined, other.token)).status,
      ).toBe(200);
    expect(
      (await request("/api/v1/transactions/aggregate", "GET", undefined, other.token)).status,
    ).toBe(429);
  });
  test("metadata returns independent facets and complete category paths, not tuple-limited rows", async () => {
    const issued = await key(["transactions:read"]);
    const insert = sqlite.prepare(
      "INSERT INTO transactions(id,user_id,date,year,month,day,type,primary_category,secondary_category,tertiary_category,amount_cents,account,currency,tags) VALUES(?,'owner','2026-01-01',2026,1,1,'expense','Food','Dining','Meals',100,?,'CNY',?)",
    );
    for (let i = 0; i < 600; i++)
      insert.run(`facet-${i}`, `Bank-${i % 30}`, JSON.stringify([`tag-${Math.floor(i / 30)}`]));
    const response = await request(
      "/api/v1/metadata?sources=transactions",
      "GET",
      undefined,
      issued.token,
    );
    expect(response.status).toBe(200);
    const data = (await response.json()).data;
    expect(data.accounts).toHaveLength(30);
    expect(data.tags).toHaveLength(20);
    expect(data.categoryPaths).toEqual([["Food", "Dining", "Meals"]]);
  });
  test("OpenAPI documents exactly the registered operations and strict write preconditions", async () => {
    const document = await (await request("/api/v1/openapi.json")).json();
    expect(document.paths["/api/v1/financial-preferences"].post).toBeUndefined();
    expect(document.paths["/api/v1/financial-preferences/{id}"]).toBeUndefined();
    for (const [path, method] of [
      ["/transactions/aggregate", "get"],
      ["/summaries/cash-flow", "get"],
      ["/units/{id}/commit", "post"],
      ["/contribution-logs/{id}/restore", "post"],
      ["/recurring-expenses/{id}/state", "post"],
      ["/ledger-replacements/preview", "post"],
      ["/ledger-replacements", "post"],
    ])
      expect(document.paths[`/api/v1${path}`]?.[method as string]).toBeDefined();
    const patch = document.paths["/api/v1/analyses/{id}"].patch;
    expect(patch.requestBody.required).toBe(true);
    expect(patch.parameters.map((p: { name: string }) => p.name)).toEqual(
      expect.arrayContaining(["id", "If-Match", "Idempotency-Key"]),
    );
    expect(
      document.paths["/api/v1/analyses"].get.parameters.map((p: { name: string }) => p.name),
    ).toEqual(expect.arrayContaining(["q", "currency", "startDate", "endDate", "limit", "cursor"]));
    const documented = Object.entries(document.paths)
      .flatMap(([path, methods]) =>
        Object.keys(methods as object).map((method) => `${method.toUpperCase()} ${path}`),
      )
      .sort();
    const actual = [
      ...new Set(
        app.routes
          .filter((r) => r.path.startsWith("/api/v1/") && r.method !== "ALL")
          .map((r) => `${r.method} ${r.path.replace(/:([^/]+)/g, "{$1}")}`),
      ),
    ].sort();
    expect(documented).toEqual(actual);
  });
});

test("unchanged availability operation is rejected without a revision or log effect", async () => {
  const issued = await key([
    "units:write",
    "units:read",
    "units:commit",
    "products:read",
    "contribution-logs:read",
  ]);
  const created = (
    await (
      await request(
        "/api/v1/units",
        "POST",
        {
          unitCode: "no-op",
          amountCents: 100,
          currency: "CNY",
          status: "计划中",
          strategy: "长期理财",
          tactics: "债券基金",
        },
        issued.token,
        { "Idempotency-Key": "noop-create" },
      )
    ).json()
  ).data;
  const before = (
    await (
      await request(`/api/v1/units/${created.id}/preflight`, "GET", undefined, issued.token)
    ).json()
  ).data;
  const response = await request(
    `/api/v1/units/${created.id}/commit`,
    "POST",
    {
      expected: before.expected,
      operations: [{ kind: "set_available_date", availableDate: null }],
    },
    issued.token,
    { "If-Match": '"1"', "Idempotency-Key": "noop-commit" },
  );
  expect(response.status).toBe(400);
  expect(sqlite.prepare("SELECT version FROM capital_units WHERE id=?").get(created.id)).toEqual({
    version: 1,
  });
  expect(sqlite.prepare("SELECT count(*) n FROM contribution_logs").get()).toEqual({ n: 0 });
});

test("title-only report patches do not resolve unchanged evidence or reveal source existence", async () => {
  const creator = await key(["transactions:write", "transactions:read", "analyses:write"]),
    writer = await key(["analyses:write"]);
  const row = (
    await (
      await request("/api/v1/transactions", "POST", tx, creator.token, {
        "Idempotency-Key": "hidden-evidence-row",
      })
    ).json()
  ).data;
  const report = {
    title: "Original",
    markdown: "Text",
    periodStart: "2026-01-01",
    periodEnd: "2026-12-31",
    currencies: ["CNY"],
    dataRevision: 0,
    evidence: [{ resource: "transactions", ids: [row.id], dataRevision: 0 }],
  };
  const created = (
    await (
      await request("/api/v1/analyses", "POST", report, creator.token, {
        "Idempotency-Key": "hidden-evidence-report",
      })
    ).json()
  ).data;
  for (const removed of [false, true]) {
    if (removed) sqlite.prepare("DELETE FROM transactions WHERE id=?").run(row.id);
    expect(
      (
        await request(
          `/api/v1/analyses/${created.id}`,
          "PATCH",
          { title: "Edited" },
          writer.token,
          { "If-Match": removed ? '"2"' : '"1"', "Idempotency-Key": crypto.randomUUID() },
        )
      ).status,
    ).toBe(200);
  }
});

test("shared core writes keep the established Drizzle epoch-second storage codec", async () => {
  const issued = await key(["transactions:write"]);
  const created = (
    await (
      await request("/api/v1/transactions", "POST", tx, issued.token, {
        "Idempotency-Key": "timestamp-codec",
      })
    ).json()
  ).data;
  const row = sqlite
    .prepare("SELECT created_at,updated_at FROM transactions WHERE id=?")
    .get(created.id) as { created_at: number; updated_at: number };
  expect(row.created_at).toBeLessThan(100000000000);
  expect(row.updated_at).toBeLessThan(100000000000);
});

test("audit cursors bind principal and limit and detect report/key-only additions", async () => {
  const issued = await key(["audit:read"]),
    other = await key(["audit:read"]);
  const path = "/api/v1/audit-events?limit=1";
  const page = await (await request(path, "GET", undefined, issued.token)).json();
  expect(page.meta.hasMore).toBe(true);
  const cursor = encodeURIComponent(page.meta.nextCursor);
  expect((await request(`${path}&cursor=${cursor}`, "GET", undefined, other.token)).status).toBe(
    400,
  );
  expect(
    (await request(`/api/v1/audit-events?limit=2&cursor=${cursor}`, "GET", undefined, issued.token))
      .status,
  ).toBe(400);
  await key(["transactions:read"]);
  expect((await request(`${path}&cursor=${cursor}`, "GET", undefined, issued.token)).status).toBe(
    409,
  );
});
test("registered machine paths reject unsupported methods uniformly after authentication", async () => {
  const issued = await key(["transactions:read"]);
  for (const [path, method, allow] of [
    ["/me", "POST", "GET"],
    ["/units/id/commit", "GET", "POST"],
    ["/summaries/cash-flow", "POST", "GET"],
    ["/financial-preferences", "POST", "GET, PUT, PATCH, DELETE"],
    ["/transactions/aggregate", "POST", "GET"],
  ]) {
    const response = await request(`/api/v1${path}`, method, undefined, issued.token);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe(allow);
    expect((await request(`/api/v1${path}`, method)).status).toBe(401);
  }
  expect((await request("/api/v1/unknown", "POST", undefined, issued.token)).status).toBe(404);
});

test("financial settings conversion fails atomically on invalid preference types or ambiguous anchor currencies", () => {
  const directory = new URL("../db/migrations/", import.meta.url);
  for (const config of [
    { savings_rate_target: null },
    { expected_return_rate: true },
    { min_return_rate: "2" },
    { balance_anchors: [{ accountName: "Bank", date: "2026-01-01", balance: 100 }] },
  ]) {
    const historical = new Database(":memory:");
    historical.pragma("foreign_keys=ON");
    for (const name of readdirSync(directory)
      .filter((name) => name.endsWith(".sql") && name < "0011")
      .sort())
      historical.exec(readFileSync(new URL(name, directory), "utf8"));
    historical.exec(
      "INSERT INTO users(id,email,provider_account_id) VALUES('old','old@test','old-google')",
    );
    for (const currency of ["人民币", "美元"])
      historical
        .prepare(
          "INSERT INTO transactions(id,user_id,date,year,month,day,primary_category,tertiary_category,amount_cents,type,account,currency) VALUES(?,'old','2026-01-01',2026,1,1,'Salary','Work',100,'income','Bank',?)",
        )
        .run(crypto.randomUUID(), currency);
    historical
      .prepare("INSERT INTO settings(owner_id,settings) VALUES('old',?)")
      .run(JSON.stringify({ ...config, ai_config: { apiKey: "disposable-fixture" } }));
    expect(() =>
      historical.transaction(() =>
        historical.exec(readFileSync(new URL("0011_scoped_api.sql", directory), "utf8")),
      )(),
    ).toThrow();
    expect(
      (historical.prepare("SELECT count(*) count FROM transactions").get() as { count: number })
        .count,
    ).toBe(2);
    expect(
      JSON.parse(
        (historical.prepare("SELECT settings FROM settings").get() as { settings: string })
          .settings,
      ),
    ).toEqual({ ...config, ai_config: { apiKey: "disposable-fixture" } });
    historical.close();
  }
});

test("status filters reject unsupported resource columns instead of executing invalid SQL", async () => {
  const issued = await key([
    "transactions:read",
    "analyses:read",
    "units:read",
    "recurring-expenses:read",
  ]);
  for (const resource of ["transactions", "analyses"])
    expect(
      (await request(`/api/v1/${resource}?status=active`, "GET", undefined, issued.token)).status,
    ).toBe(400);
  for (const resource of ["units", "recurring-expenses"])
    expect(
      (await request(`/api/v1/${resource}?status=active`, "GET", undefined, issued.token)).status,
    ).toBe(200);
});

test("audit traversal retains both concurrent create/delete effects beyond the first 500 events", async () => {
  const issued = await key(["products:write", "products:delete", "audit:read"]);
  sqlite.prepare("UPDATE api_audit SET id='0'").run();
  const seed = sqlite.prepare(
    "INSERT INTO api_audit(id,owner_id,actor_kind,request_id,operation,resource,resource_id,created_at) VALUES(?,'owner','human','fixture','fixture','products','historical',?)",
  );
  for (let i = 0; i < 499; i++) seed.run(`z-${String(i).padStart(4, "0")}`, Date.now());
  const creates = await Promise.all(
    Array.from({ length: 4 }, () =>
      request("/api/v1/products", "POST", { name: "Audited", currency: "CNY" }, issued.token, {
        "Idempotency-Key": "audit-create-concurrent",
      }),
    ),
  );
  const receipts = await Promise.all(
    creates.map(async (response) => {
      expect(response.status).toBe(201);
      return (await response.json()).data;
    }),
  );
  const id = receipts[0].id;
  expect(new Set(receipts.map((receipt) => receipt.id)).size).toBe(1);
  const deletes = await Promise.all(
    Array.from({ length: 4 }, () =>
      request(`/api/v1/products/${id}`, "DELETE", undefined, issued.token, {
        "Idempotency-Key": "audit-delete-concurrent",
        "If-Match": '"1"',
      }),
    ),
  );
  expect(deletes.map((response) => response.status)).toEqual([200, 200, 200, 200]);
  expect(
    sqlite.prepare("SELECT count(*) count FROM api_audit WHERE resource_id=?").get(id),
  ).toEqual({ count: 2 });
  const first = await (
    await request("/api/v1/audit-events?limit=500", "GET", undefined, issued.token)
  ).json();
  expect(first.meta.hasMore).toBe(true);
  expect(
    first.data.filter((event: { resourceId: string }) => event.resourceId === id),
  ).toHaveLength(1);
  const second = await (
    await request(
      `/api/v1/audit-events?limit=500&cursor=${encodeURIComponent(first.meta.nextCursor)}`,
      "GET",
      undefined,
      issued.token,
    )
  ).json();
  expect(second.meta.hasMore).toBe(false);
  expect(
    [...first.data, ...second.data].filter(
      (event: { resourceId: string }) => event.resourceId === id,
    ),
  ).toHaveLength(2);
});

test("oversized machine requests use the scoped problem contract before authentication or storage", async () => {
  const bindings = {
    ...env,
    CF_ACCESS_TEAM_DOMAIN: "access.test",
    CF_ACCESS_AUD: "fixture",
    ENVIRONMENT: "production",
    BUILD_SHA: "fixture",
  };
  for (const path of ["/api/v1", "/api/v1/transactions"]) {
    const response = await workerApp.request(
      `https://noheir.test${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(8 * 1024 * 1024 + 1),
        },
        body: "{}",
      },
      bindings,
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("Content-Type")).toContain("application/problem+json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const problem = await response.json();
    expect(problem.status).toBe(413);
    expect(problem.code).toBe("request_body_too_large");
    expect(problem.requestId).toBe(response.headers.get("X-Request-Id"));
    expect(problem.requestId).toBeTruthy();
  }
  const human = await workerApp.request(
    "https://noheir.test/api/transactions/import",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(8 * 1024 * 1024 + 1),
      },
      body: "{}",
    },
    bindings,
  );
  expect(human.status).toBe(413);
  expect(await human.json()).toEqual({ error: "Request body too large" });
});
