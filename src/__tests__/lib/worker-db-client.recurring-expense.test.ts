import { beforeEach, describe, expect, test, vi } from "vitest";
import { WorkerDbClient } from "@/lib/worker-db-client";

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function setupFetch(responses: Array<{ status: number; body?: unknown; text?: string }>) {
  const calls: CapturedRequest[] = [];
  let idx = 0;
  global.fetch = vi
    .fn()
    .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      const headers: Record<string, string> = {};
      if (init?.headers) {
        const h = init.headers as Headers | Record<string, string>;
        if (typeof (h as Headers).forEach === "function") {
          (h as Headers).forEach((v, k) => {
            headers[k.toLowerCase()] = v;
          });
        } else {
          for (const [k, v] of Object.entries(h)) {
            headers[k.toLowerCase()] = String(v);
          }
        }
      }
      let body: unknown = null;
      if (init?.body && typeof init.body === "string") {
        try {
          body = JSON.parse(init.body);
        } catch {
          body = init.body;
        }
      }
      calls.push({ url, method, headers, body });

      const resp = responses[idx++] ?? { status: 200, body: {} };
      return {
        ok: resp.status >= 200 && resp.status < 300,
        status: resp.status,
        text: async () => resp.text ?? JSON.stringify(resp.body ?? {}),
        json: async () => resp.body ?? {},
      } as unknown as Response;
    });

  function call(n: number): CapturedRequest {
    const c = calls[n];
    if (!c) throw new Error(`Expected fetch call ${n} to exist`);
    return c;
  }
  return { calls, call };
}

describe("WorkerDbClient — browser client methods", () => {
  let client: WorkerDbClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new WorkerDbClient();
  });

  test("listExpenseCategories sends GET to /api/expense-categories without internal/user headers", async () => {
    const { calls, call } = setupFetch([{ status: 200, body: { categories: [] } }]);
    await client.listExpenseCategories();
    expect(calls).toHaveLength(1);
    const req = call(0);
    expect(req.method).toBe("GET");
    expect(req.url).toBe("/api/expense-categories");
    expect(req.headers["x-user-id"]).toBeUndefined();
    expect(req.headers.authorization).toBeUndefined();
    expect(req.body).toBeNull();
  });

  test("createExpenseCategory sends POST to /api/expense-categories with JSON body", async () => {
    const payload = { name: "房租", colorToken: "chart-1" };
    const { calls, call } = setupFetch([
      {
        status: 201,
        body: {
          category: {
            id: "c1",
            userId: "u1",
            name: "房租",
            colorToken: "chart-1",
            sortOrder: 0,
          },
        },
      },
    ]);
    const res = await client.createExpenseCategory(payload);
    expect(calls).toHaveLength(1);
    const req = call(0);
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/api/expense-categories");
    expect(req.headers["content-type"]).toBe("application/json");
    expect(req.body).toEqual(payload);
    expect(res.category.id).toBe("c1");
  });

  test("updateExpenseCategory sends PUT to /api/expense-categories/:id", async () => {
    const { call } = setupFetch([
      {
        status: 200,
        body: {
          category: {
            id: "c1",
            userId: "u1",
            name: "新房租",
            colorToken: "chart-1",
            sortOrder: 0,
          },
        },
      },
    ]);
    await client.updateExpenseCategory("c1", { name: "新房租" });
    const req = call(0);
    expect(req.method).toBe("PUT");
    expect(req.url).toBe("/api/expense-categories/c1");
    expect(req.body).toEqual({ name: "新房租" });
  });

  test("deleteExpenseCategory sends DELETE to /api/expense-categories/:id", async () => {
    const { call } = setupFetch([{ status: 204 }]);
    await client.deleteExpenseCategory("c1");
    const req = call(0);
    expect(req.method).toBe("DELETE");
    expect(req.url).toBe("/api/expense-categories/c1");
  });

  test("listRecurringExpenses sends GET to /api/recurring-expenses", async () => {
    const { call } = setupFetch([{ status: 200, body: { rules: [] } }]);
    await client.listRecurringExpenses();
    const req = call(0);
    expect(req.method).toBe("GET");
    expect(req.url).toBe("/api/recurring-expenses");
  });

  test("createRecurringExpense sends POST to /api/recurring-expenses", async () => {
    const payload = {
      name: "房租",
      amountCents: 500000,
      frequency: "monthly",
      dayOfMonth: 10,
      startDate: "2026-01-01",
    };
    const { call } = setupFetch([{ status: 201, body: { rule: { id: "r1", ...payload } } }]);
    const res = await client.createRecurringExpense(payload);
    const req = call(0);
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/api/recurring-expenses");
    expect(req.body).toEqual(payload);
    expect(res.rule.id).toBe("r1");
  });

  test("updateRecurringExpense sends PUT without internal authority header", async () => {
    const { call } = setupFetch([{ status: 200, body: { rule: { id: "r1", name: "改名" } } }]);
    await client.updateRecurringExpense("r1", { name: "改名" });
    const req = call(0);
    expect(req.method).toBe("PUT");
    expect(req.url).toBe("/api/recurring-expenses/r1");
    expect(req.headers["x-internal-action"]).toBeUndefined();
    expect(req.body).toEqual({ name: "改名" });
  });

  test("transitionRecurringExpense sends POST to /api/recurring-expenses/:id/state", async () => {
    const { call } = setupFetch([{ status: 200, body: { success: true } }]);
    await client.transitionRecurringExpense("r1", "pause");
    const req = call(0);
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/api/recurring-expenses/r1/state");
    expect(req.body).toEqual({ transition: "pause" });
  });

  test("deleteRecurringExpense sends DELETE to /api/recurring-expenses/:id", async () => {
    const { call } = setupFetch([{ status: 204 }]);
    await client.deleteRecurringExpense("r1");
    const req = call(0);
    expect(req.method).toBe("DELETE");
    expect(req.url).toBe("/api/recurring-expenses/r1");
  });
});
