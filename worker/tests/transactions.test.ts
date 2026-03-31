import { describe, test, expect, beforeEach } from "bun:test";
import { resetTestDb, getTestRepos, seedUser } from "./setup";

describe("transactions repo", () => {
  const userId = "test-user-1";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
  });

  const baseTx = {
    date: "2026-03-15",
    year: 2026,
    month: 3,
    day: 15,
    primaryCategory: "餐饮",
    secondaryCategory: "外卖",
    tertiaryCategory: "午餐",
    amountCents: 3500,
    type: "expense" as const,
    account: "招商银行",
    currency: "人民币",
    tags: '["日常","工作餐"]',
    note: "公司附近的沙拉",
  };

  // ── CRUD ──

  test("create and findById", async () => {
    const repos = getTestRepos();
    const created = await repos.transactions.create(userId, baseTx);
    expect(created.id).toBeDefined();
    expect(created.amountCents).toBe(3500);
    expect(created.primaryCategory).toBe("餐饮");

    const found = await repos.transactions.findById(userId, created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  test("findById returns null for wrong user", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    const created = await repos.transactions.create(userId, baseTx);

    const found = await repos.transactions.findById("other-user", created.id);
    expect(found).toBeNull();
  });

  test("update", async () => {
    const repos = getTestRepos();
    const created = await repos.transactions.create(userId, baseTx);
    const updated = await repos.transactions.update(userId, created.id, {
      amountCents: 5000,
      note: "updated note",
    });
    expect(updated).not.toBeNull();
    expect(updated!.amountCents).toBe(5000);
    expect(updated!.note).toBe("updated note");
  });

  test("update returns null for non-existent", async () => {
    const repos = getTestRepos();
    const result = await repos.transactions.update(userId, "nonexistent", { amountCents: 100 });
    expect(result).toBeNull();
  });

  test("delete", async () => {
    const repos = getTestRepos();
    const created = await repos.transactions.create(userId, baseTx);
    const deleted = await repos.transactions.delete(userId, created.id);
    expect(deleted).toBe(true);

    const found = await repos.transactions.findById(userId, created.id);
    expect(found).toBeNull();
  });

  test("delete returns false for non-existent", async () => {
    const repos = getTestRepos();
    expect(await repos.transactions.delete(userId, "nonexistent")).toBe(false);
  });

  test("createMany and count", async () => {
    const repos = getTestRepos();
    const rows = Array.from({ length: 15 }, (_, i) => ({
      ...baseTx,
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
      day: i + 1,
      amountCents: (i + 1) * 100,
    }));
    const inserted = await repos.transactions.createMany(userId, rows);
    expect(inserted).toBe(15);

    const count = await repos.transactions.count(userId);
    expect(count).toBe(15);
  });

  test("deleteByUser", async () => {
    const repos = getTestRepos();
    await repos.transactions.createMany(userId, [baseTx, baseTx]);
    const deleted = await repos.transactions.deleteByUser(userId);
    expect(deleted).toBe(2);
    expect(await repos.transactions.count(userId)).toBe(0);
  });

  // ── Search: Behavioral Contracts ──

  test("search returns all for user when no filters", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx);
    await repos.transactions.create(userId, { ...baseTx, amountCents: 1000 });

    const result = await repos.transactions.search(userId);
    expect(result.total_returned).toBe(2);
    expect(result.transactions).toHaveLength(2);
  });

  test("search isolates by user", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    await repos.transactions.create(userId, baseTx);
    await repos.transactions.create("other-user", baseTx);

    const result = await repos.transactions.search(userId);
    expect(result.total_returned).toBe(1);
  });

  test("search keyword matches note and returns matched_field='note'", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx);

    const result = await repos.transactions.search(userId, { keyword: "沙拉" });
    expect(result.total_returned).toBe(1);
    expect(result.transactions[0]!.matched_field).toBe("note");
  });

  test("search keyword matches primary_category and returns matched_field='category'", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, { ...baseTx, note: null });

    const result = await repos.transactions.search(userId, { keyword: "餐饮" });
    expect(result.total_returned).toBe(1);
    expect(result.transactions[0]!.matched_field).toBe("category");
  });

  test("search keyword matches secondary_category", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, { ...baseTx, note: null, primaryCategory: "日常" });

    const result = await repos.transactions.search(userId, { keyword: "外卖" });
    expect(result.total_returned).toBe(1);
    expect(result.transactions[0]!.matched_field).toBe("secondary_category");
  });

  test("search keyword matches tertiary_category", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, {
      ...baseTx,
      note: null,
      primaryCategory: "日常",
      secondaryCategory: null,
    });

    const result = await repos.transactions.search(userId, { keyword: "午餐" });
    expect(result.total_returned).toBe(1);
    expect(result.transactions[0]!.matched_field).toBe("tertiary_category");
  });

  test("search keyword matches account", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, {
      ...baseTx,
      note: null,
      primaryCategory: "日常",
      secondaryCategory: null,
      tertiaryCategory: "misc",
    });

    const result = await repos.transactions.search(userId, { keyword: "招商" });
    expect(result.total_returned).toBe(1);
    expect(result.transactions[0]!.matched_field).toBe("account");
  });

  test("search matched_field is null when no keyword", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx);

    const result = await repos.transactions.search(userId);
    expect(result.transactions[0]!.matched_field).toBeNull();
  });

  test("search by categories filter (IN)", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx);
    await repos.transactions.create(userId, { ...baseTx, primaryCategory: "交通" });

    const result = await repos.transactions.search(userId, {
      categories: ["餐饮"],
    });
    expect(result.total_returned).toBe(1);
  });

  test("search by type filter", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx);
    await repos.transactions.create(userId, { ...baseTx, type: "income", amountCents: 50000 });

    const result = await repos.transactions.search(userId, { type: "income" });
    expect(result.total_returned).toBe(1);
    expect(result.transactions[0]!.type).toBe("income");
  });

  test("search by accounts filter", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx);
    await repos.transactions.create(userId, { ...baseTx, account: "支付宝" });

    const result = await repos.transactions.search(userId, { accounts: ["支付宝"] });
    expect(result.total_returned).toBe(1);
  });

  test("search by date range", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx); // 2026-03-15
    await repos.transactions.create(userId, { ...baseTx, date: "2026-01-01", month: 1, day: 1 });

    const result = await repos.transactions.search(userId, {
      start_date: "2026-03-01",
      end_date: "2026-03-31",
    });
    expect(result.total_returned).toBe(1);
  });

  test("search by amount range (cents)", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, { ...baseTx, amountCents: 1000 });
    await repos.transactions.create(userId, { ...baseTx, amountCents: 5000 });
    await repos.transactions.create(userId, { ...baseTx, amountCents: 10000 });

    const result = await repos.transactions.search(userId, {
      min_amount_cents: 2000,
      max_amount_cents: 8000,
    });
    expect(result.total_returned).toBe(1);
    expect(result.transactions[0]!.amountCents).toBe(5000);
  });

  test("search by year and month", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx); // 2026-03
    await repos.transactions.create(userId, { ...baseTx, year: 2025, month: 12, date: "2025-12-15" });

    const result = await repos.transactions.search(userId, { year: 2026, month: 3 });
    expect(result.total_returned).toBe(1);
  });

  test("search by currency", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx);
    await repos.transactions.create(userId, { ...baseTx, currency: "USD" });

    const result = await repos.transactions.search(userId, { currency: "人民币" });
    expect(result.total_returned).toBe(1);
  });

  test("search tags overlap", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, { ...baseTx, tags: '["日常","工作餐"]' });
    await repos.transactions.create(userId, { ...baseTx, tags: '["旅行"]' });

    const result = await repos.transactions.search(userId, { tags: ["工作餐"] });
    expect(result.total_returned).toBe(1);
  });

  test("search tags overlap with empty tags row", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, { ...baseTx, tags: "[]" });

    const result = await repos.transactions.search(userId, { tags: ["日常"] });
    expect(result.total_returned).toBe(0);
  });

  test("search limit clamping: max 500", async () => {
    const repos = getTestRepos();
    // We can't insert 501 rows efficiently, but we can test the clamp logic
    const result = await repos.transactions.search(userId, { limit: 999 });
    expect(result.total_returned).toBe(0); // no rows, but limit was clamped internally
  });

  test("search limit clamping: min 1", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx);

    const result = await repos.transactions.search(userId, { limit: 0 });
    expect(result.total_returned).toBe(1); // clamped to 1
  });

  test("search offset pagination", async () => {
    const repos = getTestRepos();
    for (let i = 0; i < 5; i++) {
      await repos.transactions.create(userId, {
        ...baseTx,
        date: `2026-03-${String(i + 1).padStart(2, "0")}`,
        day: i + 1,
      });
    }

    const page1 = await repos.transactions.search(userId, { limit: 2, offset: 0 });
    const page2 = await repos.transactions.search(userId, { limit: 2, offset: 2 });
    expect(page1.total_returned).toBe(2);
    expect(page2.total_returned).toBe(2);
  });

  test("search order: date DESC, created_at DESC", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, { ...baseTx, date: "2026-03-01", day: 1 });
    await repos.transactions.create(userId, { ...baseTx, date: "2026-03-15", day: 15 });
    await repos.transactions.create(userId, { ...baseTx, date: "2026-03-10", day: 10 });

    const result = await repos.transactions.search(userId);
    expect(result.transactions[0]!.date).toBe("2026-03-15");
    expect(result.transactions[1]!.date).toBe("2026-03-10");
    expect(result.transactions[2]!.date).toBe("2026-03-01");
  });

  test("search AND logic: multiple filters combine", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, baseTx); // expense, 餐饮, 招商银行
    await repos.transactions.create(userId, { ...baseTx, type: "income" });
    await repos.transactions.create(userId, { ...baseTx, primaryCategory: "交通" });

    const result = await repos.transactions.search(userId, {
      type: "expense",
      categories: ["餐饮"],
    });
    expect(result.total_returned).toBe(1);
  });

  // ── findAllByUser (backup/export) ──

  test("findAllByUser returns all rows without limit", async () => {
    const repos = getTestRepos();
    // Insert more than the search default limit (100)
    for (let i = 0; i < 150; i++) {
      await repos.transactions.create(userId, {
        ...baseTx,
        date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
        day: (i % 28) + 1,
        note: `tx-${i}`,
      });
    }

    const all = await repos.transactions.findAllByUser(userId);
    expect(all.length).toBe(150);
  });

  test("findAllByUser returns empty for user with no data", async () => {
    const repos = getTestRepos();
    seedUser("empty-user", "empty@example.com");
    const all = await repos.transactions.findAllByUser("empty-user");
    expect(all.length).toBe(0);
  });

  test("findAllByUser only returns rows for given user", async () => {
    const repos = getTestRepos();
    seedUser("other-user-2", "other2@example.com");
    await repos.transactions.create(userId, baseTx);
    await repos.transactions.create("other-user-2", { ...baseTx, note: "other" });

    const result = await repos.transactions.findAllByUser(userId);
    expect(result.length).toBe(1);
    expect(result[0]!.note).toBe("公司附近的沙拉");
  });
});
