import { beforeEach, describe, expect, test } from "vitest";
import { getTestRepos, resetTestDb, seedUser } from "./setup";

describe("transfers repo", () => {
  const userId = "test-user-1";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
  });

  const baseTr = {
    date: "2026-03-15",
    year: 2026,
    month: 3,
    day: 15,
    primaryCategory: "内部转账",
    secondaryCategory: "转账",
    transactionType: "转入",
    inflowAmountCents: 100000,
    outflowAmountCents: 0,
    currency: "人民币",
    account: "招商银行",
    tags: '["定期"]',
    note: "转入定期账户",
  };

  // ── CRUD ──

  test("create and findById", async () => {
    const repos = getTestRepos();
    const created = await repos.transfers.create(userId, baseTr);
    expect(created.id).toBeDefined();
    expect(created.inflowAmountCents).toBe(100000);

    const found = await repos.transfers.findById(userId, created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  test("findById returns null for wrong user", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    const created = await repos.transfers.create(userId, baseTr);
    expect(await repos.transfers.findById("other-user", created.id)).toBeNull();
  });

  test("update", async () => {
    const repos = getTestRepos();
    const created = await repos.transfers.create(userId, baseTr);
    const updated = await repos.transfers.update(userId, created.id, {
      inflowAmountCents: 200000,
    });
    expect(updated?.inflowAmountCents).toBe(200000);
  });

  test("delete", async () => {
    const repos = getTestRepos();
    const created = await repos.transfers.create(userId, baseTr);
    expect(await repos.transfers.delete(userId, created.id)).toBe(true);
    expect(await repos.transfers.findById(userId, created.id)).toBeNull();
  });

  test("createMany and count", async () => {
    const repos = getTestRepos();
    const rows = Array.from({ length: 12 }, (_, i) => ({
      ...baseTr,
      day: i + 1,
      date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    }));
    expect(await repos.transfers.createMany(userId, rows)).toBe(12);
    expect(await repos.transfers.count(userId)).toBe(12);
  });

  test("deleteByUser", async () => {
    const repos = getTestRepos();
    await repos.transfers.createMany(userId, [baseTr, baseTr]);
    expect(await repos.transfers.deleteByUser(userId)).toBe(2);
    expect(await repos.transfers.count(userId)).toBe(0);
  });

  // ── Search: Behavioral Contracts ──

  test("search returns all for user when no filters", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr);
    const result = await repos.transfers.search(userId);
    expect(result.total_returned).toBe(1);
  });

  test("search keyword matches note → matched_field='note'", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr);
    const result = await repos.transfers.search(userId, { keyword: "定期账户" });
    expect(result.total_returned).toBe(1);
    expect(result.transfers[0]?.matched_field).toBe("note");
  });

  test("search keyword matches primaryCategory → matched_field='category'", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, { ...baseTr, note: null });
    const result = await repos.transfers.search(userId, { keyword: "内部" });
    expect(result.total_returned).toBe(1);
    expect(result.transfers[0]?.matched_field).toBe("category");
  });

  test("search keyword matches secondaryCategory → matched_field='category' (NOT 'secondary_category')", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, { ...baseTr, note: null, primaryCategory: null });
    const result = await repos.transfers.search(userId, { keyword: "转账" });
    expect(result.total_returned).toBe(1);
    expect(result.transfers[0]?.matched_field).toBe("category");
  });

  test("search keyword matches account → matched_field='account'", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, {
      ...baseTr,
      note: null,
      primaryCategory: null,
      secondaryCategory: null,
    });
    const result = await repos.transfers.search(userId, { keyword: "招商" });
    expect(result.total_returned).toBe(1);
    expect(result.transfers[0]?.matched_field).toBe("account");
  });

  test("search by accounts filter", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr);
    await repos.transfers.create(userId, { ...baseTr, account: "支付宝" });
    const result = await repos.transfers.search(userId, { accounts: ["支付宝"] });
    expect(result.total_returned).toBe(1);
  });

  test("search by transaction_type", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr);
    await repos.transfers.create(userId, { ...baseTr, transactionType: "转出" });
    const result = await repos.transfers.search(userId, { transaction_type: "转出" });
    expect(result.total_returned).toBe(1);
  });

  test("search amount filter uses MAX(inflow, outflow)", async () => {
    const repos = getTestRepos();
    // inflow=100000, outflow=0 → max=100000
    await repos.transfers.create(userId, baseTr);
    // inflow=0, outflow=50000 → max=50000
    await repos.transfers.create(userId, {
      ...baseTr,
      inflowAmountCents: 0,
      outflowAmountCents: 50000,
    });

    const result = await repos.transfers.search(userId, {
      min_amount_cents: 60000,
    });
    expect(result.total_returned).toBe(1);
    expect(result.transfers[0]?.inflowAmountCents).toBe(100000);
  });

  test("search tags overlap", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr);
    await repos.transfers.create(userId, { ...baseTr, tags: '["活期"]' });
    const result = await repos.transfers.search(userId, { tags: ["定期"] });
    expect(result.total_returned).toBe(1);
  });

  test("search limit clamping", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr);
    const result = await repos.transfers.search(userId, { limit: 0 });
    expect(result.total_returned).toBe(1); // clamped to 1
  });

  test("search date range", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr);
    await repos.transfers.create(userId, {
      ...baseTr,
      date: "2025-01-01",
      year: 2025,
      month: 1,
      day: 1,
    });
    const result = await repos.transfers.search(userId, {
      start_date: "2026-01-01",
      end_date: "2026-12-31",
    });
    expect(result.total_returned).toBe(1);
  });

  test("search year+month filter", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr);
    await repos.transfers.create(userId, { ...baseTr, year: 2025, month: 12, date: "2025-12-15" });
    const result = await repos.transfers.search(userId, { year: 2026, month: 3 });
    expect(result.total_returned).toBe(1);
  });

  test("search order: date DESC", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, { ...baseTr, date: "2026-03-01", day: 1 });
    await repos.transfers.create(userId, { ...baseTr, date: "2026-03-20", day: 20 });
    const result = await repos.transfers.search(userId);
    expect(result.transfers[0]?.date).toBe("2026-03-20");
  });

  // ── findAllByUser (backup/export) ──

  test("findAllByUser returns all rows without limit", async () => {
    const repos = getTestRepos();
    for (let i = 0; i < 150; i++) {
      await repos.transfers.create(userId, {
        ...baseTr,
        date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
        day: (i % 28) + 1,
        note: `tr-${i}`,
      });
    }

    const all = await repos.transfers.findAllByUser(userId);
    expect(all.length).toBe(150);
  });

  test("findAllByUser returns empty for user with no data", async () => {
    const repos = getTestRepos();
    seedUser("empty-user", "empty@example.com");
    const all = await repos.transfers.findAllByUser("empty-user");
    expect(all.length).toBe(0);
  });

  test("findAllByUser only returns rows for given user", async () => {
    const repos = getTestRepos();
    seedUser("other-user-2", "other2@example.com");
    await repos.transfers.create(userId, baseTr);
    await repos.transfers.create("other-user-2", { ...baseTr, note: "other" });

    const result = await repos.transfers.findAllByUser(userId);
    expect(result.length).toBe(1);
    expect(result[0]?.note).toBe("转入定期账户");
  });

  // ── findAllByYear ──

  test("findAllByYear returns all rows for given year", async () => {
    const repos = getTestRepos();
    for (let i = 0; i < 5; i++) {
      await repos.transfers.create(userId, {
        ...baseTr,
        date: `2026-03-${String(i + 1).padStart(2, "0")}`,
        day: i + 1,
      });
    }
    const result = await repos.transfers.findAllByYear(userId, 2026);
    expect(result.length).toBe(5);
  });

  test("findAllByYear excludes rows from other years", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr); // year 2026
    await repos.transfers.create(userId, {
      ...baseTr,
      date: "2025-06-15",
      year: 2025,
      month: 6,
      day: 15,
    });

    const result = await repos.transfers.findAllByYear(userId, 2026);
    expect(result.length).toBe(1);
    expect(result[0]?.year).toBe(2026);
  });

  test("findAllByYear isolates by user", async () => {
    const repos = getTestRepos();
    seedUser("other-user-3", "other3@example.com");
    await repos.transfers.create(userId, baseTr);
    await repos.transfers.create("other-user-3", baseTr);

    const result = await repos.transfers.findAllByYear(userId, 2026);
    expect(result.length).toBe(1);
  });

  test("findAllByYear returns empty for year with no data", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, baseTr); // year 2026
    const result = await repos.transfers.findAllByYear(userId, 1999);
    expect(result.length).toBe(0);
  });

  test("findAllByYear results are ordered by date DESC", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, { ...baseTr, date: "2026-03-01", day: 1 });
    await repos.transfers.create(userId, { ...baseTr, date: "2026-03-20", day: 20 });
    await repos.transfers.create(userId, { ...baseTr, date: "2026-03-10", day: 10 });

    const result = await repos.transfers.findAllByYear(userId, 2026);
    expect(result.length).toBe(3);
    expect(result[0]?.date).toBe("2026-03-20");
    expect(result[1]?.date).toBe("2026-03-10");
    expect(result[2]?.date).toBe("2026-03-01");
  });
});
