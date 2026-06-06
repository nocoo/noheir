import { beforeEach, describe, expect, test } from "vitest";
import { getTestRepos, resetTestDb, seedUser } from "./setup";
import type { RecurringExpenseCreateInput } from "../db/repositories";

const userId = "test-user-1";
const otherId = "other-user";

function baseRule(
  overrides: Partial<RecurringExpenseCreateInput> = {},
): RecurringExpenseCreateInput {
  return {
    name: "中行车险",
    amountCents: 800_000, // ¥8000
    frequency: "yearly",
    interval: 1,
    monthOfYear: 1,
    dayOfMonth: 5,
    startDate: "2026-01-05",
    ...overrides,
  };
}

describe("recurring_expenses repo (P1-C4)", () => {
  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
    seedUser(otherId, "other@example.com");
  });

  test("create stores defaults: status='active', currency='CNY', endedAt=null", async () => {
    const repos = getTestRepos();
    const res = await repos.recurringExpenses.create(userId, baseRule());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rule).toMatchObject({
      userId,
      status: "active",
      currency: "CNY",
      endedAt: null,
      interval: 1,
    });
    expect(res.rule.id).toBeTruthy();
  });

  test("create rejects cross-user category with category_not_found", async () => {
    const repos = getTestRepos();
    const cat = await repos.expenseCategories.create(otherId, {
      name: "owned-by-other",
      colorToken: "chart-1",
    });
    if (!cat.ok) throw new Error("seed");

    const res = await repos.recurringExpenses.create(userId, {
      ...baseRule(),
      categoryId: cat.category.id,
    });
    expect(res).toEqual({ ok: false, reason: "category_not_found" });
  });

  test("findAll left-joins category metadata and isolates by userId", async () => {
    const repos = getTestRepos();
    const cat = await repos.expenseCategories.create(userId, {
      name: "保险",
      colorToken: "chart-9",
    });
    if (!cat.ok) throw new Error("seed");

    await repos.recurringExpenses.create(userId, {
      ...baseRule(),
      categoryId: cat.category.id,
    });
    await repos.recurringExpenses.create(userId, baseRule({ name: "房租" }));
    await repos.recurringExpenses.create(otherId, baseRule({ name: "ignored" }));

    const rows = await repos.recurringExpenses.findAll(userId);
    expect(rows).toHaveLength(2);

    const withCategory = rows.find((r) => r.name === "中行车险");
    expect(withCategory?.categoryName).toBe("保险");
    expect(withCategory?.colorToken).toBe("chart-9");

    const noCategory = rows.find((r) => r.name === "房租");
    expect(noCategory?.categoryName).toBeNull();
    expect(noCategory?.colorToken).toBeNull();
  });

  test("ON DELETE SET NULL: deleting category nulls referring rule's categoryId, rule remains", async () => {
    const repos = getTestRepos();
    const cat = await repos.expenseCategories.create(userId, {
      name: "to-delete",
      colorToken: "chart-1",
    });
    if (!cat.ok) throw new Error("seed");

    const rule = await repos.recurringExpenses.create(userId, {
      ...baseRule(),
      categoryId: cat.category.id,
    });
    if (!rule.ok) throw new Error("seed");

    // Sanity: rule has the category before deletion
    const before = await repos.recurringExpenses.findById(userId, rule.rule.id);
    expect(before?.categoryId).toBe(cat.category.id);

    const deleted = await repos.expenseCategories.delete(userId, cat.category.id);
    expect(deleted).toBe(true);

    const after = await repos.recurringExpenses.findById(userId, rule.rule.id);
    expect(after).not.toBeNull();
    expect(after?.categoryId).toBeNull();
    // Rule is otherwise intact
    expect(after?.name).toBe("中行车险");
    expect(after?.amountCents).toBe(800_000);
  });

  test("update writes status + endedAt (repo layer; route layer guards via header)", async () => {
    const repos = getTestRepos();
    const created = await repos.recurringExpenses.create(userId, baseRule());
    if (!created.ok) throw new Error("seed");

    const res = await repos.recurringExpenses.update(userId, created.rule.id, {
      status: "ended",
      endedAt: "2026-06-07",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rule.status).toBe("ended");
    expect(res.rule.endedAt).toBe("2026-06-07");
  });

  test("update on unknown id returns not_found", async () => {
    const repos = getTestRepos();
    const res = await repos.recurringExpenses.update(userId, "missing", {
      name: "x",
    });
    expect(res).toEqual({ ok: false, reason: "not_found" });
  });

  test("update cannot reassign to another user's category", async () => {
    const repos = getTestRepos();
    const owned = await repos.expenseCategories.create(otherId, {
      name: "other-cat",
      colorToken: "chart-1",
    });
    if (!owned.ok) throw new Error("seed");
    const rule = await repos.recurringExpenses.create(userId, baseRule());
    if (!rule.ok) throw new Error("seed");

    const res = await repos.recurringExpenses.update(userId, rule.rule.id, {
      categoryId: owned.category.id,
    });
    expect(res).toEqual({ ok: false, reason: "category_not_found" });
  });

  test("delete is userId-scoped", async () => {
    const repos = getTestRepos();
    const rule = await repos.recurringExpenses.create(userId, baseRule());
    if (!rule.ok) throw new Error("seed");

    expect(await repos.recurringExpenses.delete(otherId, rule.rule.id)).toBe(false);
    expect(await repos.recurringExpenses.findById(userId, rule.rule.id))
      .not.toBeNull();

    expect(await repos.recurringExpenses.delete(userId, rule.rule.id)).toBe(true);
    expect(await repos.recurringExpenses.findById(userId, rule.rule.id)).toBeNull();
  });

  test("findAll orders by name asc then createdAt desc", async () => {
    const repos = getTestRepos();
    await repos.recurringExpenses.create(userId, baseRule({ name: "b" }));
    await new Promise((r) => setTimeout(r, 5));
    await repos.recurringExpenses.create(userId, baseRule({ name: "a" }));
    await new Promise((r) => setTimeout(r, 5));
    await repos.recurringExpenses.create(userId, baseRule({ name: "a" }));

    const rows = await repos.recurringExpenses.findAll(userId);
    expect(rows.map((r) => r.name)).toEqual(["a", "a", "b"]);
    // For duplicate names, newer-created comes first
    expect(rows[0].createdAt.getTime()).toBeGreaterThanOrEqual(
      rows[1].createdAt.getTime(),
    );
  });
});
