import { describe, test, expect, beforeEach } from "vitest";
import { resetTestDb, getTestRepos, seedUser } from "./setup";

describe("reports repo", () => {
  const userId = "test-user-1";

  beforeEach(() => {
    resetTestDb();
    seedUser(userId);
  });

  const makeTx = (overrides: Record<string, unknown> = {}) => ({
    date: "2026-03-15",
    year: 2026,
    month: 3,
    day: 15,
    primaryCategory: "餐饮",
    tertiaryCategory: "午餐",
    amountCents: 5000,
    type: "expense" as const,
    account: "招商银行",
    currency: "人民币",
    ...overrides,
  });

  const makeTr = (overrides: Record<string, unknown> = {}) => ({
    date: "2026-03-15",
    year: 2026,
    month: 3,
    day: 15,
    account: "招商银行",
    currency: "人民币",
    inflowAmountCents: 0,
    outflowAmountCents: 0,
    ...overrides,
  });

  test("monthly returns zeros when no data", async () => {
    const repos = getTestRepos();
    const report = await repos.reports.monthly(userId, 2026, 3);
    expect(report.total_income).toBe(0);
    expect(report.total_expense).toBe(0);
    expect(report.net_amount).toBe(0);
    expect(report.transaction_count).toBe(0);
    expect(report.transfer_count).toBe(0);
    expect(report.total_transfer_in).toBe(0);
    expect(report.total_transfer_out).toBe(0);
    expect(report.expense_by_category).toEqual([]);
    expect(report.income_by_category).toEqual([]);
    expect(report.currencies).toEqual([]);
  });

  test("monthly: income and expense totals", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, makeTx({ type: "income", amountCents: 100000 }));
    await repos.transactions.create(userId, makeTx({ type: "income", amountCents: 50000 }));
    await repos.transactions.create(userId, makeTx({ type: "expense", amountCents: 3000 }));
    await repos.transactions.create(userId, makeTx({ type: "expense", amountCents: 7000 }));

    const report = await repos.reports.monthly(userId, 2026, 3);
    expect(report.total_income).toBe(150000);
    expect(report.total_expense).toBe(10000);
    expect(report.net_amount).toBe(140000); // income - expense
  });

  test("monthly: transaction and transfer counts", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, makeTx());
    await repos.transactions.create(userId, makeTx());
    await repos.transfers.create(userId, makeTr());

    const report = await repos.reports.monthly(userId, 2026, 3);
    expect(report.transaction_count).toBe(2);
    expect(report.transfer_count).toBe(1);
  });

  test("monthly: transfer totals", async () => {
    const repos = getTestRepos();
    await repos.transfers.create(userId, makeTr({ inflowAmountCents: 50000 }));
    await repos.transfers.create(
      userId,
      makeTr({ inflowAmountCents: 30000, outflowAmountCents: 10000 }),
    );

    const report = await repos.reports.monthly(userId, 2026, 3);
    expect(report.total_transfer_in).toBe(80000);
    expect(report.total_transfer_out).toBe(10000);
  });

  test("monthly: expense_by_category sorted by total DESC", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, makeTx({ primaryCategory: "餐饮", amountCents: 5000 }));
    await repos.transactions.create(userId, makeTx({ primaryCategory: "餐饮", amountCents: 3000 }));
    await repos.transactions.create(
      userId,
      makeTx({ primaryCategory: "交通", amountCents: 10000 }),
    );

    const report = await repos.reports.monthly(userId, 2026, 3);
    expect(report.expense_by_category).toHaveLength(2);
    // 交通 (10000) should be first, then 餐饮 (8000)
    expect(report.expense_by_category[0]!.category).toBe("交通");
    expect(report.expense_by_category[0]!.total).toBe(10000);
    expect(report.expense_by_category[0]!.count).toBe(1);
    expect(report.expense_by_category[1]!.category).toBe("餐饮");
    expect(report.expense_by_category[1]!.total).toBe(8000);
    expect(report.expense_by_category[1]!.count).toBe(2);
  });

  test("monthly: income_by_category", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(
      userId,
      makeTx({ type: "income", primaryCategory: "工资", amountCents: 200000 }),
    );
    await repos.transactions.create(
      userId,
      makeTx({ type: "income", primaryCategory: "投资", amountCents: 10000 }),
    );

    const report = await repos.reports.monthly(userId, 2026, 3);
    expect(report.income_by_category).toHaveLength(2);
    expect(report.income_by_category[0]!.category).toBe("工资");
    expect(report.income_by_category[0]!.total).toBe(200000);
  });

  test("monthly: filters by year and month", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, makeTx({ year: 2026, month: 3 }));
    await repos.transactions.create(userId, makeTx({ year: 2026, month: 2, date: "2026-02-15" }));
    await repos.transactions.create(userId, makeTx({ year: 2025, month: 3, date: "2025-03-15" }));

    const report = await repos.reports.monthly(userId, 2026, 3);
    expect(report.transaction_count).toBe(1);
  });

  test("monthly: optional currency filter", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, makeTx({ currency: "人民币", amountCents: 5000 }));
    await repos.transactions.create(userId, makeTx({ currency: "USD", amountCents: 3000 }));

    const cnyReport = await repos.reports.monthly(userId, 2026, 3, "人民币");
    expect(cnyReport.transaction_count).toBe(1);
    expect(cnyReport.total_expense).toBe(5000);

    const allReport = await repos.reports.monthly(userId, 2026, 3);
    expect(allReport.transaction_count).toBe(2);
    expect(allReport.total_expense).toBe(8000);
  });

  test("monthly: currencies from both tables", async () => {
    const repos = getTestRepos();
    await repos.transactions.create(userId, makeTx({ currency: "人民币" }));
    await repos.transfers.create(userId, makeTr({ currency: "USD" }));

    const report = await repos.reports.monthly(userId, 2026, 3);
    expect(report.currencies).toContain("人民币");
    expect(report.currencies).toContain("USD");
  });

  test("monthly: user isolation", async () => {
    const repos = getTestRepos();
    seedUser("other-user", "other@example.com");
    await repos.transactions.create(userId, makeTx({ amountCents: 5000 }));
    await repos.transactions.create("other-user", makeTx({ amountCents: 99999 }));

    const report = await repos.reports.monthly(userId, 2026, 3);
    expect(report.transaction_count).toBe(1);
    expect(report.total_expense).toBe(5000);
  });
});
