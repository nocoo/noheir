import { describe, expect, it } from "vitest";
import {
  buildYearComparisonChartData,
  buildYearVsYearData,
  buildMonthVsMonthData,
} from "@/domain/dashboard/year-comparison";

describe("buildYearComparisonChartData", () => {
  it("builds chart data with correct savingsRate", () => {
    const data = [
      {
        year: 2024,
        totalIncome: 1000,
        totalExpense: 400,
        balance: 600,
        categoryBreakdown: [],
      },
    ];
    const chart = buildYearComparisonChartData(data);
    expect(chart[0]?.year).toBe("2024");
    expect(chart[0]?.income).toBe(1000);
    expect(chart[0]?.expense).toBe(400);
    expect(chart[0]?.balance).toBe(600);
    expect(chart[0]?.savingsRate).toBe(60);
  });

  it("returns 0 savingsRate when totalIncome is 0", () => {
    const data = [
      {
        year: 2024,
        totalIncome: 0,
        totalExpense: 100,
        balance: -100,
        categoryBreakdown: [],
      },
    ];
    const chart = buildYearComparisonChartData(data);
    expect(chart[0]?.savingsRate).toBe(0);
  });

  it("handles empty array", () => {
    expect(buildYearComparisonChartData([])).toEqual([]);
  });
});

describe("buildYearVsYearData", () => {
  it("returns 12-month comparison with matching data", () => {
    const yearA = [
      { month: "一月", income: 5000, expense: 3000, balance: 2000 },
      { month: "三月", income: 4000, expense: 2000, balance: 2000 },
    ];
    const yearB = [
      { month: "一月", income: 6000, expense: 2500, balance: 3500 },
    ];
    const result = buildYearVsYearData(yearA, yearB);
    expect(result).toHaveLength(12);

    // 一月 — both years have data
    expect(result[0]?.month).toBe("一月");
    expect(result[0]?.incomeA).toBe(5000);
    expect(result[0]?.expenseA).toBe(3000);
    expect(result[0]?.savingsRateA).toBeCloseTo(40);
    expect(result[0]?.incomeB).toBe(6000);
    expect(result[0]?.savingsRateB).toBeCloseTo(58.333, 2);

    // 二月 — neither year has data
    expect(result[1]?.incomeA).toBe(0);
    expect(result[1]?.savingsRateA).toBe(0);
    expect(result[1]?.incomeB).toBe(0);
    expect(result[1]?.savingsRateB).toBe(0);

    // 三月 — only yearA
    expect(result[2]?.incomeA).toBe(4000);
    expect(result[2]?.incomeB).toBe(0);
  });

  it("handles empty arrays for both years", () => {
    const result = buildYearVsYearData([], []);
    expect(result).toHaveLength(12);
    result.forEach((pt) => {
      expect(pt.incomeA).toBe(0);
      expect(pt.incomeB).toBe(0);
      expect(pt.savingsRateA).toBe(0);
      expect(pt.savingsRateB).toBe(0);
    });
  });

  it("returns 0 savingsRate when income is 0", () => {
    const yearA = [{ month: "一月", income: 0, expense: 500, balance: -500 }];
    const result = buildYearVsYearData(yearA, []);
    expect(result[0]?.savingsRateA).toBe(0);
  });
});

describe("buildMonthVsMonthData", () => {
  it("builds comparison for two months with data", () => {
    const a = { month: "一月", income: 5000, expense: 3000, balance: 2000 };
    const b = { month: "二月", income: 6000, expense: 4000, balance: 2000 };
    const result = buildMonthVsMonthData("2024-01", a, "2025-01", b);
    expect(result).toHaveLength(2);
    expect(result[0]?.label).toBe("2024-01");
    expect(result[0]?.income).toBe(5000);
    expect(result[0]?.savingsRate).toBeCloseTo(40);
    expect(result[1]?.label).toBe("2025-01");
    expect(result[1]?.income).toBe(6000);
    expect(result[1]?.savingsRate).toBeCloseTo(33.333, 2);
  });

  it("handles undefined months with defaults", () => {
    const result = buildMonthVsMonthData("2024-01", undefined, "2025-01", undefined);
    expect(result).toHaveLength(2);
    expect(result[0]?.income).toBe(0);
    expect(result[0]?.expense).toBe(0);
    expect(result[0]?.savingsRate).toBe(0);
    expect(result[1]?.income).toBe(0);
    expect(result[1]?.savingsRate).toBe(0);
  });

  it("handles 0 income with 0 savingsRate", () => {
    const a = { month: "一月", income: 0, expense: 100, balance: -100 };
    const result = buildMonthVsMonthData("2024-01", a, "2025-01", undefined);
    expect(result[0]?.savingsRate).toBe(0);
  });
});
