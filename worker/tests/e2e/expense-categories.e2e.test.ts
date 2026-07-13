import { beforeEach, describe, expect, test } from "vitest";
import { ensureTestUser } from "./helpers/cleanup";
import { api, BASE_URL, rawFetch, TEST_USER_A } from "./helpers/client";

const userId = TEST_USER_A;

interface Category {
  id: string;
  userId: string;
  name: string;
  colorToken: string;
  sortOrder: number;
}

async function cleanupCategories(uid: string): Promise<void> {
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

describe("E2E: /api/expense-categories (P1-C5)", () => {
  beforeEach(async () => {
    await ensureTestUser(userId);
    await cleanupCategories(userId);
  });

  test("GET returns empty list for a fresh user", async () => {
    const res = await api<{ categories: Category[] }>({
      method: "GET",
      path: "/api/expense-categories",
      userId,
    });
    expect(res.categories).toEqual([]);
  });

  test("POST creates with 201 + returns category; GET reflects it", async () => {
    const create = await rawFetch({
      method: "POST",
      path: "/api/expense-categories",
      userId,
      body: { name: "保险", colorToken: "chart-9" },
    });
    expect(create.status).toBe(201);
    const { category } = (await create.json()) as { category: Category };
    expect(category).toMatchObject({
      userId,
      name: "保险",
      colorToken: "chart-9",
      sortOrder: 0,
    });

    const list = await api<{ categories: Category[] }>({
      method: "GET",
      path: "/api/expense-categories",
      userId,
    });
    expect(list.categories.map((c) => c.id)).toContain(category.id);
  });

  test("POST with bad colorToken → 400", async () => {
    const res = await rawFetch({
      method: "POST",
      path: "/api/expense-categories",
      userId,
      body: { name: "x", colorToken: "rgb(123,45,67)" },
    });
    expect(res.status).toBe(400);
  });

  test("POST duplicate (user, name) → 409", async () => {
    await api({
      method: "POST",
      path: "/api/expense-categories",
      userId,
      body: { name: "dup", colorToken: "chart-1" },
    });
    const second = await rawFetch({
      method: "POST",
      path: "/api/expense-categories",
      userId,
      body: { name: "dup", colorToken: "chart-2" },
    });
    expect(second.status).toBe(409);
  });

  test("PUT updates name + colorToken; PUT on unknown id → 404", async () => {
    const { category } = await api<{ category: Category }>({
      method: "POST",
      path: "/api/expense-categories",
      userId,
      body: { name: "rename-me", colorToken: "chart-1" },
    });

    const updated = await api<{ category: Category }>({
      method: "PUT",
      path: `/api/expense-categories/${category.id}`,
      userId,
      body: { name: "renamed", colorToken: "chart-9" },
    });
    expect(updated.category).toMatchObject({
      id: category.id,
      name: "renamed",
      colorToken: "chart-9",
    });

    const missing = await rawFetch({
      method: "PUT",
      path: "/api/expense-categories/00000000-0000-0000-0000-000000000000",
      userId,
      body: { name: "x" },
    });
    expect(missing.status).toBe(404);
  });

  test("DELETE returns 204 then 404; payload absent", async () => {
    const { category } = await api<{ category: Category }>({
      method: "POST",
      path: "/api/expense-categories",
      userId,
      body: { name: "to-del", colorToken: "chart-1" },
    });

    const ok = await rawFetch({
      method: "DELETE",
      path: `/api/expense-categories/${category.id}`,
      userId,
    });
    expect(ok.status).toBe(204);

    const again = await rawFetch({
      method: "DELETE",
      path: `/api/expense-categories/${category.id}`,
      userId,
    });
    expect(again.status).toBe(404);
  });

  test("CORS preflight allows the standard headers", async () => {
    // OPTIONS preflight from a browser-style request
    const res = await fetch(`${BASE_URL}/api/expense-categories`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://noheir.app",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization, X-User-Id",
      },
    });
    expect(res.status).toBeLessThan(400);
    const allowHeaders = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    expect(allowHeaders).toContain("x-user-id");
  });
});
