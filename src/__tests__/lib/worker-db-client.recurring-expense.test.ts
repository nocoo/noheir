import { beforeEach, describe, expect, test, vi } from "vitest";
import { WorkerDbClient } from "@/lib/worker-db-client";

const TOKEN = "tok";
const BASE = "https://noheir.worker.test";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown | null;
}

function setupFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: CapturedRequest[] = [];
  let idx = 0;
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    const raw = (init?.headers ?? {}) as Record<string, string>;
    for (const [k, v] of Object.entries(raw)) {
      headers[k.toLowerCase()] = v;
    }
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: init?.body != null ? JSON.parse(init.body as string) : null,
    });
    const r = responses[idx++] ?? { status: 200 };
    return new Response(r.body != null ? JSON.stringify(r.body) : null, {
      status: r.status,
      headers:
        r.status === 204
          ? {}
          : { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  function call(i: number): CapturedRequest {
    const c = calls[i];
    if (!c) throw new Error(`no request at index ${i}`);
    return c;
  }
  return { calls, call };
}

describe("WorkerDbClient — expense category methods (P2-C5)", () => {
  let client: WorkerDbClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new WorkerDbClient(BASE, TOKEN);
  });

  test("listExpenseCategories sends GET with auth + user headers", async () => {
    const { calls, call } = setupFetch([
      { status: 200, body: { categories: [] } },
    ]);
    await client.listExpenseCategories("u1");
    expect(calls).toHaveLength(1);
    const req = call(0);
    expect(req.method).toBe("GET");
    expect(req.url).toBe(`${BASE}/api/expense-categories`);
    expect(req.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(req.headers["x-user-id"]).toBe("u1");
    expect(req.headers["x-target-db"]).toBeUndefined();
    expect(req.body).toBeNull();
  });

  test("createExpenseCategory POSTs the payload as JSON", async () => {
    const { call } = setupFetch([
      {
        status: 201,
        body: {
          category: {
            id: "c1",
            userId: "u1",
            name: "保险",
            colorToken: "chart-9",
            sortOrder: 0,
          },
        },
      },
    ]);
    const res = await client.createExpenseCategory("u1", {
      name: "保险",
      colorToken: "chart-9",
    });
    expect(call(0).method).toBe("POST");
    expect(call(0).url).toBe(`${BASE}/api/expense-categories`);
    expect(call(0).body).toEqual({ name: "保险", colorToken: "chart-9" });
    expect(res.category.id).toBe("c1");
  });

  test("updateExpenseCategory PUTs to /:id", async () => {
    const { call } = setupFetch([
      { status: 200, body: { category: { id: "c1" } } },
    ]);
    await client.updateExpenseCategory("u1", "c1", { name: "renamed" });
    expect(call(0).method).toBe("PUT");
    expect(call(0).url).toBe(`${BASE}/api/expense-categories/c1`);
    expect(call(0).body).toEqual({ name: "renamed" });
  });

  test("deleteExpenseCategory DELETEs and tolerates 204", async () => {
    const { call } = setupFetch([{ status: 204 }]);
    await expect(
      client.deleteExpenseCategory("u1", "c1"),
    ).resolves.toBeUndefined();
    expect(call(0).method).toBe("DELETE");
    expect(call(0).url).toBe(`${BASE}/api/expense-categories/c1`);
  });
});

describe("WorkerDbClient — recurring expense methods (P2-C6)", () => {
  let client: WorkerDbClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new WorkerDbClient(BASE, TOKEN);
  });

  test("listRecurringExpenses GET", async () => {
    const { call } = setupFetch([
      { status: 200, body: { rules: [] } },
    ]);
    await client.listRecurringExpenses("u1");
    expect(call(0).method).toBe("GET");
    expect(call(0).url).toBe(`${BASE}/api/recurring-expenses`);
  });

  test("createRecurringExpense POSTs payload", async () => {
    const { call } = setupFetch([
      { status: 201, body: { rule: { id: "r1" } } },
    ]);
    await client.createRecurringExpense("u1", {
      name: "中行车险",
      amountCents: 800_000,
      frequency: "yearly",
      interval: 1,
      monthOfYear: 1,
      dayOfMonth: 5,
      startDate: "2026-01-05",
    });
    expect(call(0).method).toBe("POST");
    expect(call(0).body).toMatchObject({ name: "中行车险" });
  });

  test("updateRecurringExpense (default) does NOT send X-Internal-Action", async () => {
    const { call } = setupFetch([
      { status: 200, body: { rule: { id: "r1" } } },
    ]);
    await client.updateRecurringExpense("u1", "r1", { name: "renamed" });
    expect(call(0).headers["x-internal-action"]).toBeUndefined();
  });

  test("updateRecurringExpense with internal:true sends X-Internal-Action: 1", async () => {
    const { call } = setupFetch([
      { status: 200, body: { rule: { id: "r1" } } },
    ]);
    await client.updateRecurringExpense(
      "u1",
      "r1",
      { status: "paused" },
      { internal: true },
    );
    expect(call(0).headers["x-internal-action"]).toBe("1");
  });

  test("updateRecurringExpense with internal:false explicit also omits the header", async () => {
    const { call } = setupFetch([
      { status: 200, body: { rule: { id: "r1" } } },
    ]);
    await client.updateRecurringExpense(
      "u1",
      "r1",
      { name: "x" },
      { internal: false },
    );
    expect(call(0).headers["x-internal-action"]).toBeUndefined();
  });

  test("deleteRecurringExpense DELETE 204", async () => {
    const { call } = setupFetch([{ status: 204 }]);
    await client.deleteRecurringExpense("u1", "r1");
    expect(call(0).method).toBe("DELETE");
    expect(call(0).url).toBe(`${BASE}/api/recurring-expenses/r1`);
  });

  test("error responses throw WorkerDbError with status code and endpoint", async () => {
    setupFetch([{ status: 409, body: { error: "dup" } }]);
    await expect(
      client.createExpenseCategory("u1", { name: "x", colorToken: "chart-1" }),
    ).rejects.toMatchObject({
      name: "WorkerDbError",
      statusCode: 409,
      endpoint: "POST /api/expense-categories",
    });
  });
});
