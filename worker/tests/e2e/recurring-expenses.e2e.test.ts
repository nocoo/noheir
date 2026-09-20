import { beforeEach, describe, expect, test } from "vitest";
import { ensureTestUser } from "./helpers/cleanup";
import { api, BASE_URL, rawFetch, TEST_USER_B } from "./helpers/client";

const userId = TEST_USER_B;

interface Rule {
  id: string;
  userId: string;
  name: string;
  amountCents: number;
  frequency: string;
  interval: number;
  startDate: string;
  endDate: string | null;
  status: "active" | "paused" | "ended";
  endedAt: string | null;
  categoryId: string | null;
  categoryName: string | null;
  colorToken: string | null;
}

interface Category {
  id: string;
  name: string;
}

async function cleanupRulesAndCategories(uid: string): Promise<void> {
  const { rules } = await api<{ rules: Rule[] }>({
    method: "GET",
    path: "/api/recurring-expenses",
    userId: uid,
  });
  for (const r of rules) {
    await rawFetch({
      method: "DELETE",
      path: `/api/recurring-expenses/${r.id}`,
      userId: uid,
    });
  }
  const { categories } = await api<{ categories: Category[] }>({
    method: "GET",
    path: "/api/expense-categories",
    userId: uid,
  });
  for (const c of categories) {
    await rawFetch({
      method: "DELETE",
      path: `/api/expense-categories/${c.id}`,
      userId: uid,
    });
  }
}

const yearlyRule = {
  name: "中行车险",
  amountCents: 800_000,
  frequency: "yearly" as const,
  interval: 1,
  monthOfYear: 1,
  dayOfMonth: 5,
  startDate: "2026-01-05",
};

describe("E2E: /api/recurring-expenses (P1-C6)", () => {
  beforeEach(async () => {
    await ensureTestUser(userId);
    await cleanupRulesAndCategories(userId);
  });

  test("GET empty list for fresh user", async () => {
    const { rules } = await api<{ rules: Rule[] }>({
      method: "GET",
      path: "/api/recurring-expenses",
      userId,
    });
    expect(rules).toEqual([]);
  });

  test("POST creates rule with defaults (status='active', endedAt=null)", async () => {
    const res = await rawFetch({
      method: "POST",
      path: "/api/recurring-expenses",
      userId,
      body: yearlyRule,
    });
    expect(res.status).toBe(201);
    const { rule } = (await res.json()) as { rule: Rule };
    expect(rule).toMatchObject({
      userId,
      name: "中行车险",
      amountCents: 800_000,
      status: "active",
      endedAt: null,
    });
  });

  test("invalid schedules are rejected before creation or update", async () => {
    for (const body of [
      { ...yearlyRule, monthOfYear: null },
      { ...yearlyRule, frequency: "monthly", dayOfMonth: null },
      { ...yearlyRule, frequency: "weekly" },
      { ...yearlyRule, startDate: "2026-02-30" },
      { ...yearlyRule, endDate: "2026-01-01" },
    ]) {
      expect(
        (await rawFetch({ method: "POST", path: "/api/recurring-expenses", userId, body })).status,
      ).toBe(400);
    }
    expect(await api({ path: "/api/recurring-expenses", userId })).toEqual({ rules: [] });
    const { rule } = await api<{ rule: Rule }>({
      method: "POST",
      path: "/api/recurring-expenses",
      userId,
      body: { ...yearlyRule, interval: 2, currency: "USD" },
    });
    for (const body of [{ dayOfMonth: null }, { frequency: "weekly" }, { endDate: "2025-12-31" }]) {
      expect(
        (
          await rawFetch({
            method: "PUT",
            path: `/api/recurring-expenses/${rule.id}`,
            userId,
            body,
          })
        ).status,
      ).toBe(400);
    }
    const updated = await api<{ rule: Rule }>({
      method: "PUT",
      path: `/api/recurring-expenses/${rule.id}`,
      userId,
      body: { name: "Renamed" },
    });
    expect(updated.rule).toMatchObject({
      name: "Renamed",
      interval: 2,
      currency: "USD",
      frequency: "yearly",
      dayOfMonth: 5,
      endDate: null,
    });
  });

  test("POST with categoryId joins category on list", async () => {
    const { category } = await api<{ category: Category }>({
      method: "POST",
      path: "/api/expense-categories",
      userId,
      body: { name: "保险", colorToken: "chart-9" },
    });
    await api({
      method: "POST",
      path: "/api/recurring-expenses",
      userId,
      body: { ...yearlyRule, categoryId: category.id },
    });

    const { rules } = await api<{ rules: Rule[] }>({
      method: "GET",
      path: "/api/recurring-expenses",
      userId,
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].categoryName).toBe("保险");
    expect(rules[0].colorToken).toBe("chart-9");
  });

  test("PUT without X-Internal-Action header DROPS status + endedAt from body", async () => {
    const { rule } = await api<{ rule: Rule }>({
      method: "POST",
      path: "/api/recurring-expenses",
      userId,
      body: yearlyRule,
    });

    const updateRes = await rawFetch({
      method: "PUT",
      path: `/api/recurring-expenses/${rule.id}`,
      userId,
      body: {
        name: "updated-name",
        status: "paused",
        endedAt: "2026-06-07",
      },
    });
    expect(updateRes.status).toBe(200);
    const { rule: updated } = (await updateRes.json()) as { rule: Rule };
    // name advanced; status/endedAt silently dropped
    expect(updated.name).toBe("updated-name");
    expect(updated.status).toBe("active");
    expect(updated.endedAt).toBeNull();
  });

  test("DELETE returns 204 then 404", async () => {
    const { rule } = await api<{ rule: Rule }>({
      method: "POST",
      path: "/api/recurring-expenses",
      userId,
      body: yearlyRule,
    });
    const ok = await rawFetch({
      method: "DELETE",
      path: `/api/recurring-expenses/${rule.id}`,
      userId,
    });
    expect(ok.status).toBe(204);
    const again = await rawFetch({
      method: "DELETE",
      path: `/api/recurring-expenses/${rule.id}`,
      userId,
    });
    expect(again.status).toBe(404);
  });

  test("does not allow cross-origin internal-action requests", async () => {
    const res = await fetch(`${BASE_URL}/api/recurring-expenses/anything`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://noheir.app",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "X-Internal-Action",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).not.toBe("https://noheir.app");
  });
});
