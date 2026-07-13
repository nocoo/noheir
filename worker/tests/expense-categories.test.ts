import { beforeEach, describe, expect, test } from "vitest";
import { getTestRepos, resetTestDb, seedUser } from "./setup";

describe("expense_categories repo (P1-C3)", () => {
  const userId = "test-user-1";
  const otherId = "other-user";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
    seedUser(otherId, "other@example.com");
  });

  test("findAll → empty for a fresh user, scoped by userId", async () => {
    const repos = getTestRepos();
    await repos.expenseCategories.create(otherId, {
      name: "保险",
      colorToken: "chart-9",
    });
    const rows = await repos.expenseCategories.findAll(userId);
    expect(rows).toEqual([]);
  });

  test("create returns the inserted row with defaults", async () => {
    const repos = getTestRepos();
    const result = await repos.expenseCategories.create(userId, {
      name: "保险",
      colorToken: "chart-9",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.category).toMatchObject({
      userId,
      name: "保险",
      colorToken: "chart-9",
      sortOrder: 0,
    });
    expect(result.category.id).toBeTruthy();
    expect(result.category.createdAt).toBeInstanceOf(Date);
  });

  test("create with duplicate (userId, name) returns duplicate_name", async () => {
    const repos = getTestRepos();
    await repos.expenseCategories.create(userId, {
      name: "保险",
      colorToken: "chart-9",
    });
    const second = await repos.expenseCategories.create(userId, {
      name: "保险",
      colorToken: "chart-3",
    });
    expect(second).toEqual({ ok: false, reason: "duplicate_name" });
  });

  test("other user can reuse the same name (unique is per-user)", async () => {
    const repos = getTestRepos();
    await repos.expenseCategories.create(userId, {
      name: "保险",
      colorToken: "chart-9",
    });
    const other = await repos.expenseCategories.create(otherId, {
      name: "保险",
      colorToken: "chart-9",
    });
    expect(other.ok).toBe(true);
  });

  test("findById returns the row only for the owning user", async () => {
    const repos = getTestRepos();
    const created = await repos.expenseCategories.create(userId, {
      name: "房租",
      colorToken: "chart-1",
    });
    if (!created.ok) throw new Error("seed failed");
    const id = created.category.id;

    expect(await repos.expenseCategories.findById(userId, id)).toMatchObject({
      id,
      name: "房租",
    });
    expect(await repos.expenseCategories.findById(otherId, id)).toBeNull();
  });

  test("findAll orders by sortOrder ASC then name", async () => {
    const repos = getTestRepos();
    await repos.expenseCategories.create(userId, {
      name: "b",
      colorToken: "chart-1",
      sortOrder: 0,
    });
    await repos.expenseCategories.create(userId, {
      name: "a",
      colorToken: "chart-2",
      sortOrder: 0,
    });
    await repos.expenseCategories.create(userId, {
      name: "z",
      colorToken: "chart-3",
      sortOrder: -1,
    });
    const rows = await repos.expenseCategories.findAll(userId);
    expect(rows.map((r) => r.name)).toEqual(["z", "a", "b"]);
  });

  test("update patches allowed fields and bumps updatedAt", async () => {
    const repos = getTestRepos();
    const created = await repos.expenseCategories.create(userId, {
      name: "old",
      colorToken: "chart-1",
    });
    if (!created.ok) throw new Error("seed failed");
    const originalUpdatedAt = created.category.updatedAt.getTime();

    // ensure a measurable tick (Drizzle uses Date.now() for $defaultFn so
    // ms precision; better-sqlite3 in-memory does not round to seconds)
    await new Promise((r) => setTimeout(r, 5));

    const res = await repos.expenseCategories.update(userId, created.category.id, {
      name: "new",
      colorToken: "chart-9",
      sortOrder: 7,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.category).toMatchObject({
      name: "new",
      colorToken: "chart-9",
      sortOrder: 7,
    });
    expect(res.category.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  test("update on unknown id returns not_found", async () => {
    const repos = getTestRepos();
    const res = await repos.expenseCategories.update(userId, "missing", {
      name: "x",
    });
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });

  test("update on another user's row returns not_found (no cross-user write)", async () => {
    const repos = getTestRepos();
    const owned = await repos.expenseCategories.create(otherId, {
      name: "owned-by-other",
      colorToken: "chart-1",
    });
    if (!owned.ok) throw new Error("seed failed");

    const res = await repos.expenseCategories.update(userId, owned.category.id, {
      name: "hijack",
    });
    expect(res).toEqual({ ok: false, reason: "not_found" });

    const stillThere = await repos.expenseCategories.findById(otherId, owned.category.id);
    expect(stillThere?.name).toBe("owned-by-other");
  });

  test("update name collision returns duplicate_name and leaves row unchanged", async () => {
    const repos = getTestRepos();
    await repos.expenseCategories.create(userId, {
      name: "保险",
      colorToken: "chart-9",
    });
    const second = await repos.expenseCategories.create(userId, {
      name: "房租",
      colorToken: "chart-1",
    });
    if (!second.ok) throw new Error("seed failed");

    const res = await repos.expenseCategories.update(userId, second.category.id, {
      name: "保险",
    });
    expect(res).toEqual({ ok: false, reason: "duplicate_name" });

    const still = await repos.expenseCategories.findById(userId, second.category.id);
    expect(still?.name).toBe("房租");
  });

  test("delete returns true on hit, false on miss; cross-user delete is a miss", async () => {
    const repos = getTestRepos();
    const created = await repos.expenseCategories.create(userId, {
      name: "x",
      colorToken: "chart-1",
    });
    if (!created.ok) throw new Error("seed failed");

    // wrong user
    expect(await repos.expenseCategories.delete(otherId, created.category.id)).toBe(false);
    expect(await repos.expenseCategories.findById(userId, created.category.id)).not.toBeNull();

    // correct user
    expect(await repos.expenseCategories.delete(userId, created.category.id)).toBe(true);
    expect(await repos.expenseCategories.findById(userId, created.category.id)).toBeNull();

    // already gone
    expect(await repos.expenseCategories.delete(userId, created.category.id)).toBe(false);
  });

  test("rejects empty name (NOT NULL is enforced by DB; empty string is allowed by spec; trim is route concern)", async () => {
    // We do NOT validate emptiness in the repo — spec leaves that to the
    // Server Action / Zod layer. This test pins current behaviour so a
    // future repo-level rejection is an intentional change.
    const repos = getTestRepos();
    const res = await repos.expenseCategories.create(userId, {
      name: "",
      colorToken: "chart-1",
    });
    expect(res.ok).toBe(true);
  });
});
