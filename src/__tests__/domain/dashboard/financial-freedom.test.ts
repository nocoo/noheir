import { describe, expect, it } from "vitest";
import {
  buildFreedomSummary,
  buildIncomeBreakdown,
  buildIncreaseIncomeScenario,
  buildReduceExpenseScenario,
  buildTotalExpense,
} from "@/domain/dashboard/financial-freedom";
import type { DomainTransaction } from "@/domain/types";

const transactions: DomainTransaction[] = [
  {
    id: "1",
    date: "2024-01-01",
    year: 2024,
    month: 1,
    primaryCategory: "収入",
    secondaryCategory: "工资",
    tertiaryCategory: "月薪",
    amount: 1000,
    account: "A",
    type: "income",
    currency: "CNY",
    tags: [],
    note: null,
  },
  {
    id: "2",
    date: "2024-01-02",
    year: 2024,
    month: 1,
    primaryCategory: "支出",
    secondaryCategory: "餐饮",
    tertiaryCategory: "午餐",
    amount: 200,
    account: "A",
    type: "expense",
    currency: "CNY",
    tags: [],
    note: null,
  },
];

describe("financial-freedom domain", () => {
  it("builds income breakdown", () => {
    const result = buildIncomeBreakdown(transactions, ["月薪"]);
    expect(result.activeIncome).toBe(1000);
  });

  it("builds total expense and summary", () => {
    const totalExpense = buildTotalExpense(transactions);
    const summary = buildFreedomSummary(totalExpense, 100);
    expect(summary.totalExpense).toBe(200);
  });

  it("builds scenarios", () => {
    const scenario1 = buildReduceExpenseScenario(1000, 200, 10);
    const scenario2 = buildIncreaseIncomeScenario(1000, 200, 50);
    expect(scenario1.currentValue).toBe(900);
    expect(scenario2.targetValue).toBe(300);
  });
});
