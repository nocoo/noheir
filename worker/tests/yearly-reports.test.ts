import { describe, test, expect, beforeEach } from "bun:test";
import { resetTestDb, getTestRepos, seedUser } from "./setup";

describe("reports repo — yearly aggregation", () => {
  const userId = "test-user-1";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
  });

  const makeTx = (overrides: Record<string, unknown> = {}) => ({
    date: "2025-03-15",
    year: 2025,
    month: 3,
    day: 15,
    primaryCategory: "餐饮",
    secondaryCategory: "外卖",
    tertiaryCategory: "午餐",
    amountCents: 5000,
    type: "expense" as const,
    account: "招商银行",
    currency: "人民币",
    ...overrides,
  });

  // ── yearlySummary ──

  describe("yearlySummary", () => {
    test("returns 12 months with zeros when no data", async () => {
      const repos = getTestRepos();
      const result = await repos.reports.yearlySummary(userId, 2025);
      expect(result.months).toHaveLength(12);
      expect(result.totals.income).toBe(0);
      expect(result.totals.expense).toBe(0);
      expect(result.totals.count).toBe(0);
      // All months should be zero
      for (const m of result.months) {
        expect(m.income).toBe(0);
        expect(m.expense).toBe(0);
        expect(m.count).toBe(0);
      }
    });

    test("aggregates income and expense per month", async () => {
      const repos = getTestRepos();
      // Jan income
      await repos.transactions.create(userId, makeTx({ month: 1, day: 1, date: "2025-01-01", type: "income", amountCents: 100000 }));
      await repos.transactions.create(userId, makeTx({ month: 1, day: 2, date: "2025-01-02", type: "income", amountCents: 50000 }));
      // Jan expense
      await repos.transactions.create(userId, makeTx({ month: 1, day: 3, date: "2025-01-03", type: "expense", amountCents: 30000 }));
      // Mar expense
      await repos.transactions.create(userId, makeTx({ month: 3, day: 15, date: "2025-03-15", type: "expense", amountCents: 5000 }));

      const result = await repos.reports.yearlySummary(userId, 2025);

      // Month 1 (January) — index 0
      expect(result.months[0]!.month).toBe(1);
      expect(result.months[0]!.income).toBe(150000);
      expect(result.months[0]!.expense).toBe(30000);
      expect(result.months[0]!.count).toBe(3);

      // Month 3 (March) — index 2
      expect(result.months[2]!.month).toBe(3);
      expect(result.months[2]!.income).toBe(0);
      expect(result.months[2]!.expense).toBe(5000);
      expect(result.months[2]!.count).toBe(1);

      // Month 2 (February) — no data
      expect(result.months[1]!.income).toBe(0);
      expect(result.months[1]!.expense).toBe(0);
      expect(result.months[1]!.count).toBe(0);

      // Totals
      expect(result.totals.income).toBe(150000);
      expect(result.totals.expense).toBe(35000);
      expect(result.totals.count).toBe(4);
    });

    test("filters by year", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({ year: 2025, month: 1, date: "2025-01-01" }));
      await repos.transactions.create(userId, makeTx({ year: 2024, month: 1, date: "2024-01-01" }));

      const result2025 = await repos.reports.yearlySummary(userId, 2025);
      expect(result2025.totals.count).toBe(1);

      const result2024 = await repos.reports.yearlySummary(userId, 2024);
      expect(result2024.totals.count).toBe(1);
    });

    test("user isolation", async () => {
      const repos = getTestRepos();
      seedUser("other-user", "other@example.com");
      await repos.transactions.create(userId, makeTx({ amountCents: 5000 }));
      await repos.transactions.create("other-user", makeTx({ amountCents: 99999 }));

      const result = await repos.reports.yearlySummary(userId, 2025);
      expect(result.totals.count).toBe(1);
      expect(result.totals.expense).toBe(5000);
    });

    test("months are ordered 1-12", async () => {
      const repos = getTestRepos();
      // Insert in reverse order
      await repos.transactions.create(userId, makeTx({ month: 12, date: "2025-12-01" }));
      await repos.transactions.create(userId, makeTx({ month: 1, date: "2025-01-01" }));

      const result = await repos.reports.yearlySummary(userId, 2025);
      expect(result.months[0]!.month).toBe(1);
      expect(result.months[11]!.month).toBe(12);
    });
  });

  // ── categorySummary ──

  describe("categorySummary", () => {
    test("returns empty when no data", async () => {
      const repos = getTestRepos();
      const result = await repos.reports.categorySummary(userId, 2025);
      expect(result.categories).toEqual([]);
    });

    test("groups by primary/secondary/tertiary with totals", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({
        primaryCategory: "餐饮", secondaryCategory: "外卖", tertiaryCategory: "午餐",
        amountCents: 3000,
      }));
      await repos.transactions.create(userId, makeTx({
        primaryCategory: "餐饮", secondaryCategory: "外卖", tertiaryCategory: "午餐",
        amountCents: 2000,
      }));
      await repos.transactions.create(userId, makeTx({
        primaryCategory: "餐饮", secondaryCategory: "堂食", tertiaryCategory: "晚餐",
        amountCents: 8000,
      }));

      const result = await repos.reports.categorySummary(userId, 2025);
      expect(result.categories).toHaveLength(2);

      // Sorted by total DESC
      expect(result.categories[0]!.primary_category).toBe("餐饮");
      expect(result.categories[0]!.secondary_category).toBe("堂食");
      expect(result.categories[0]!.tertiary_category).toBe("晚餐");
      expect(result.categories[0]!.total).toBe(8000);
      expect(result.categories[0]!.count).toBe(1);

      expect(result.categories[1]!.total).toBe(5000);
      expect(result.categories[1]!.count).toBe(2);
    });

    test("filters by type", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({ type: "income", amountCents: 100000 }));
      await repos.transactions.create(userId, makeTx({ type: "expense", amountCents: 5000 }));

      const incomeResult = await repos.reports.categorySummary(userId, 2025, undefined, "income");
      expect(incomeResult.categories).toHaveLength(1);
      expect(incomeResult.categories[0]!.total).toBe(100000);

      const expenseResult = await repos.reports.categorySummary(userId, 2025, undefined, "expense");
      expect(expenseResult.categories).toHaveLength(1);
      expect(expenseResult.categories[0]!.total).toBe(5000);
    });

    test("filters by month", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({ month: 1, date: "2025-01-15", amountCents: 1000 }));
      await repos.transactions.create(userId, makeTx({ month: 1, date: "2025-01-20", amountCents: 2000 }));
      await repos.transactions.create(userId, makeTx({ month: 3, date: "2025-03-15", amountCents: 5000 }));

      const janResult = await repos.reports.categorySummary(userId, 2025, 1);
      expect(janResult.categories).toHaveLength(1);
      expect(janResult.categories[0]!.total).toBe(3000);
      expect(janResult.categories[0]!.count).toBe(2);

      const marResult = await repos.reports.categorySummary(userId, 2025, 3);
      expect(marResult.categories).toHaveLength(1);
      expect(marResult.categories[0]!.total).toBe(5000);
      expect(marResult.categories[0]!.count).toBe(1);
    });

    test("filters by month and type combined", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({ month: 1, type: "income", amountCents: 100000 }));
      await repos.transactions.create(userId, makeTx({ month: 1, type: "expense", amountCents: 3000 }));
      await repos.transactions.create(userId, makeTx({ month: 3, type: "expense", amountCents: 5000 }));

      const janExpense = await repos.reports.categorySummary(userId, 2025, 1, "expense");
      expect(janExpense.categories).toHaveLength(1);
      expect(janExpense.categories[0]!.total).toBe(3000);

      const janIncome = await repos.reports.categorySummary(userId, 2025, 1, "income");
      expect(janIncome.categories).toHaveLength(1);
      expect(janIncome.categories[0]!.total).toBe(100000);
    });

    test("returns all types when type is omitted", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({
        type: "income", primaryCategory: "工资", tertiaryCategory: "月薪", amountCents: 100000,
      }));
      await repos.transactions.create(userId, makeTx({ type: "expense", amountCents: 5000 }));

      const result = await repos.reports.categorySummary(userId, 2025);
      expect(result.categories).toHaveLength(2);
    });

    test("user isolation", async () => {
      const repos = getTestRepos();
      seedUser("other-user", "other@example.com");
      await repos.transactions.create(userId, makeTx());
      await repos.transactions.create("other-user", makeTx({ amountCents: 99999 }));

      const result = await repos.reports.categorySummary(userId, 2025);
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0]!.total).toBe(5000);
    });
  });

  // ── accountSummary ──

  describe("accountSummary", () => {
    test("returns empty when no data", async () => {
      const repos = getTestRepos();
      const result = await repos.reports.accountSummary(userId, 2025);
      expect(result.accounts).toEqual([]);
    });

    test("groups by account and type", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({
        account: "招商银行", type: "income", amountCents: 100000,
      }));
      await repos.transactions.create(userId, makeTx({
        account: "招商银行", type: "income", amountCents: 50000,
      }));
      await repos.transactions.create(userId, makeTx({
        account: "招商银行", type: "expense", amountCents: 3000,
      }));
      await repos.transactions.create(userId, makeTx({
        account: "工商银行", type: "expense", amountCents: 7000,
      }));

      const result = await repos.reports.accountSummary(userId, 2025);
      expect(result.accounts).toHaveLength(3); // 招商-income, 招商-expense, 工商-expense

      // Sorted by total DESC
      const zhaoshangIncome = result.accounts.find(
        (a) => a.account === "招商银行" && a.type === "income",
      );
      expect(zhaoshangIncome!.total).toBe(150000);
      expect(zhaoshangIncome!.count).toBe(2);

      const gonghangExpense = result.accounts.find(
        (a) => a.account === "工商银行" && a.type === "expense",
      );
      expect(gonghangExpense!.total).toBe(7000);
      expect(gonghangExpense!.count).toBe(1);
    });

    test("filters by year", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({ year: 2025, month: 1, date: "2025-01-01" }));
      await repos.transactions.create(userId, makeTx({ year: 2024, month: 1, date: "2024-01-01" }));

      const result = await repos.reports.accountSummary(userId, 2025);
      expect(result.accounts).toHaveLength(1);
    });

    test("user isolation", async () => {
      const repos = getTestRepos();
      seedUser("other-user", "other@example.com");
      await repos.transactions.create(userId, makeTx());
      await repos.transactions.create("other-user", makeTx({ amountCents: 99999 }));

      const result = await repos.reports.accountSummary(userId, 2025);
      expect(result.accounts).toHaveLength(1);
      expect(result.accounts[0]!.total).toBe(5000);
    });
  });

  // ── flowSummary ──

  describe("flowSummary", () => {
    test("returns empty arrays when no data", async () => {
      const repos = getTestRepos();
      const result = await repos.reports.flowSummary(userId, 2025);
      expect(result.account_to_category).toEqual([]);
      expect(result.category_to_subcategory).toEqual([]);
    });

    test("groups account_to_category by type/account/primary", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({
        type: "expense", account: "招商银行", primaryCategory: "餐饮",
        amountCents: 5000,
      }));
      await repos.transactions.create(userId, makeTx({
        type: "expense", account: "招商银行", primaryCategory: "餐饮",
        amountCents: 3000,
      }));
      await repos.transactions.create(userId, makeTx({
        type: "income", account: "工商银行", primaryCategory: "工资",
        amountCents: 100000,
      }));

      const result = await repos.reports.flowSummary(userId, 2025);
      expect(result.account_to_category).toHaveLength(2);

      const zhaoshangDining = result.account_to_category.find(
        (r) => r.account === "招商银行" && r.type === "expense",
      );
      expect(zhaoshangDining!.total).toBe(8000);

      const gonghangSalary = result.account_to_category.find(
        (r) => r.account === "工商银行" && r.type === "income",
      );
      expect(gonghangSalary!.total).toBe(100000);
    });

    test("groups category_to_subcategory by type/primary/secondary", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({
        primaryCategory: "餐饮", secondaryCategory: "外卖",
        amountCents: 5000,
      }));
      await repos.transactions.create(userId, makeTx({
        primaryCategory: "餐饮", secondaryCategory: "堂食",
        amountCents: 8000,
      }));

      const result = await repos.reports.flowSummary(userId, 2025);
      expect(result.category_to_subcategory).toHaveLength(2);

      // Sorted by total DESC
      expect(result.category_to_subcategory[0]!.primary_category).toBe("餐饮");
      expect(result.category_to_subcategory[0]!.secondary_category).toBe("堂食");
      expect(result.category_to_subcategory[0]!.total).toBe(8000);
    });

    test("filters by year", async () => {
      const repos = getTestRepos();
      await repos.transactions.create(userId, makeTx({ year: 2025 }));
      await repos.transactions.create(userId, makeTx({ year: 2024, date: "2024-03-15" }));

      const result = await repos.reports.flowSummary(userId, 2025);
      expect(result.account_to_category).toHaveLength(1);
      expect(result.category_to_subcategory).toHaveLength(1);
    });

    test("user isolation", async () => {
      const repos = getTestRepos();
      seedUser("other-user", "other@example.com");
      await repos.transactions.create(userId, makeTx());
      await repos.transactions.create("other-user", makeTx({ amountCents: 99999 }));

      const result = await repos.reports.flowSummary(userId, 2025);
      expect(result.account_to_category).toHaveLength(1);
      expect(result.account_to_category[0]!.total).toBe(5000);
    });
  });
});
