import { beforeEach, describe, expect, test } from "vitest";
import { getTestRepos, resetTestDb, seedUser } from "./setup";

describe("metadata repo", () => {
  const userId = "test-user-1";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
  });

  test("returns empty metadata when no data", async () => {
    const repos = getTestRepos();
    const meta = await repos.metadata.getAll(userId);
    expect(meta.years).toEqual([]);
    expect(meta.accounts).toEqual([]);
    expect(meta.categories).toEqual([]);
    expect(meta.secondary_categories).toEqual([]);
    expect(meta.tertiary_categories).toEqual([]);
    expect(meta.currencies).toEqual([]);
    expect(meta.tags).toEqual([]);
    expect(meta.transaction_count).toBe(0);
    expect(meta.transfer_count).toBe(0);
  });

  test("years: UNION DISTINCT from transactions + transfers, sorted DESC", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, {
      date: "2026-03-15",
      year: 2026,
      month: 3,
      day: 15,
      primaryCategory: "餐饮",
      tertiaryCategory: "午餐",
      amountCents: 1000,
      type: "expense",
      account: "招商银行",
    });
    await repos.transactions.create(userId, {
      date: "2025-12-01",
      year: 2025,
      month: 12,
      day: 1,
      primaryCategory: "餐饮",
      tertiaryCategory: "午餐",
      amountCents: 1000,
      type: "expense",
      account: "招商银行",
    });
    await repos.transfers.create(userId, {
      date: "2024-06-01",
      year: 2024,
      month: 6,
      day: 1,
      account: "支付宝",
    });

    const meta = await repos.metadata.getAll(userId);
    expect(meta.years).toEqual([2026, 2025, 2024]);
  });

  test("accounts: UNION DISTINCT from both tables, sorted ASC", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      primaryCategory: "A",
      tertiaryCategory: "B",
      amountCents: 100,
      type: "expense",
      account: "招商银行",
    });
    await repos.transfers.create(userId, {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      account: "支付宝",
    });
    await repos.transfers.create(userId, {
      date: "2026-01-02",
      year: 2026,
      month: 1,
      day: 2,
      account: "招商银行", // duplicate across tables
    });

    const meta = await repos.metadata.getAll(userId);
    // Chinese sorting: 招商银行 < 支付宝 in locale sort
    expect(meta.accounts).toHaveLength(2);
    expect(new Set(meta.accounts)).toEqual(new Set(["支付宝", "招商银行"]));
  });

  test("categories: DISTINCT primary_category from transactions, sorted ASC", async () => {
    const repos = getTestRepos();
    const base = {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      tertiaryCategory: "X",
      amountCents: 100,
      type: "expense" as const,
      account: "A",
    };
    await repos.transactions.create(userId, { ...base, primaryCategory: "餐饮" });
    await repos.transactions.create(userId, { ...base, primaryCategory: "交通" });
    await repos.transactions.create(userId, { ...base, primaryCategory: "餐饮" }); // duplicate

    const meta = await repos.metadata.getAll(userId);
    expect(meta.categories).toEqual(["交通", "餐饮"]);
  });

  test("secondary_categories: excludes null and empty", async () => {
    const repos = getTestRepos();
    const base = {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      primaryCategory: "A",
      tertiaryCategory: "B",
      amountCents: 100,
      type: "expense" as const,
      account: "X",
    };
    await repos.transactions.create(userId, { ...base, secondaryCategory: "外卖" });
    await repos.transactions.create(userId, { ...base, secondaryCategory: "" });
    await repos.transactions.create(userId, { ...base, secondaryCategory: null });

    const meta = await repos.metadata.getAll(userId);
    expect(meta.secondary_categories).toEqual(["外卖"]);
  });

  test("currencies: UNION from both tables", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      primaryCategory: "A",
      tertiaryCategory: "B",
      amountCents: 100,
      type: "expense",
      account: "X",
      currency: "人民币",
    });
    await repos.transfers.create(userId, {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      account: "Y",
      currency: "USD",
    });

    const meta = await repos.metadata.getAll(userId);
    expect(meta.currencies).toContain("人民币");
    expect(meta.currencies).toContain("USD");
  });

  test("tags: parsed from JSON, unique, sorted", async () => {
    const repos = getTestRepos();
    const base = {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      primaryCategory: "A",
      tertiaryCategory: "B",
      amountCents: 100,
      type: "expense" as const,
      account: "X",
    };
    await repos.transactions.create(userId, { ...base, tags: '["日常","工作餐"]' });
    await repos.transactions.create(userId, { ...base, tags: '["旅行","日常"]' }); // "日常" is duplicate
    await repos.transfers.create(userId, {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      account: "Y",
      tags: '["定期"]',
    });

    const meta = await repos.metadata.getAll(userId);
    expect(new Set(meta.tags)).toEqual(new Set(["工作餐", "定期", "日常", "旅行"]));
  });

  test("transaction_count and transfer_count", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      primaryCategory: "A",
      tertiaryCategory: "B",
      amountCents: 100,
      type: "expense",
      account: "X",
    });
    await repos.transactions.create(userId, {
      date: "2026-01-02",
      year: 2026,
      month: 1,
      day: 2,
      primaryCategory: "A",
      tertiaryCategory: "B",
      amountCents: 200,
      type: "expense",
      account: "X",
    });
    await repos.transfers.create(userId, {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      account: "Y",
    });

    const meta = await repos.metadata.getAll(userId);
    expect(meta.transaction_count).toBe(2);
    expect(meta.transfer_count).toBe(1);
  });

  test("user isolation", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    await repos.transactions.create(userId, {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      primaryCategory: "A",
      tertiaryCategory: "B",
      amountCents: 100,
      type: "expense",
      account: "X",
    });
    await repos.transactions.create("other-user", {
      date: "2026-01-01",
      year: 2026,
      month: 1,
      day: 1,
      primaryCategory: "C",
      tertiaryCategory: "D",
      amountCents: 200,
      type: "income",
      account: "Y",
    });

    const meta = await repos.metadata.getAll(userId);
    expect(meta.transaction_count).toBe(1);
    expect(meta.categories).toEqual(["A"]);
  });
});
