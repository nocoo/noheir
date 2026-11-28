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
  it("builds income breakdown for active and passive income", () => {
    const withPassive: DomainTransaction[] = [
      ...transactions,
      {
        id: "3",
        date: "2024-01-03",
        year: 2024,
        month: 1,
        primaryCategory: "収入",
        secondaryCategory: null,
        tertiaryCategory: "股息",
        amount: 300,
        account: "A",
        type: "income",
        currency: "CNY",
        tags: [],
        note: null,
      },
    ];
    const result = buildIncomeBreakdown(withPassive, ["月薪"]);
    expect(result.activeIncome).toBe(1000);
    expect(result.passiveIncome).toBe(300);
  });

  it("builds total expense and summary including zero baselines", () => {
    const totalExpense = buildTotalExpense(transactions);
    const summary = buildFreedomSummary(totalExpense, 100);
    expect(summary.totalExpense).toBe(200);
    expect(summary.isFree).toBe(false);

    const zeroSummary = buildFreedomSummary(0, 0);
    expect(zeroSummary.freedomRatio).toBe(0);
    expect(zeroSummary.requiredPassiveIncrease).toBe(0);
  });

  it("builds scenarios", () => {
    const scenario1 = buildReduceExpenseScenario(1000, 200, 10);
    const scenario2 = buildIncreaseIncomeScenario(1000, 200, 50);
    const zeroReduce = buildReduceExpenseScenario(0, 0, 10);
    const zeroIncrease = buildIncreaseIncomeScenario(0, 0, 10);
    expect(scenario1.currentValue).toBe(900);
    expect(scenario2.targetValue).toBe(300);
    expect(zeroReduce.percentage).toBe(0);
    expect(zeroIncrease.percentage).toBe(0);
  });
});
