import type { YearlyComparison, MonthlyData } from "../types";
import { MONTH_NAMES } from "@/lib/constants";

// ── Existing year-over-year chart (kept for backwards compat) ──

export interface YearComparisonChartPoint {
  year: string;
  income: number;
  expense: number;
  balance: number;
  savingsRate: number;
}

export const buildYearComparisonChartData = (
  data: YearlyComparison[],
): YearComparisonChartPoint[] => {
  return data.map((item) => {
    const savingsRate =
      item.totalIncome > 0
        ? ((item.totalIncome - item.totalExpense) / item.totalIncome) * 100
        : 0;
    return {
      year: item.year.toString(),
      income: item.totalIncome,
      expense: item.totalExpense,
      balance: item.balance,
      savingsRate,
    };
  });
};

// ── Year-vs-Year monthly comparison ──

export interface YearMonthComparisonPoint {
  month: string; // "一月" ... "十二月"
  incomeA: number;
  expenseA: number;
  savingsRateA: number;
  incomeB: number;
  expenseB: number;
  savingsRateB: number;
}

/**
 * Build 12-month side-by-side comparison data for two years.
 * Each year provides a MonthlyData[] (length 0–12).
 */
export const buildYearVsYearData = (
  yearAMonths: MonthlyData[],
  yearBMonths: MonthlyData[],
): YearMonthComparisonPoint[] => {
  return MONTH_NAMES.map((name) => {
    const a = yearAMonths.find((m) => m.month === name) ?? {
      income: 0,
      expense: 0,
    };
    const b = yearBMonths.find((m) => m.month === name) ?? {
      income: 0,
      expense: 0,
    };
    return {
      month: name,
      incomeA: a.income,
      expenseA: a.expense,
      savingsRateA:
        a.income > 0 ? ((a.income - a.expense) / a.income) * 100 : 0,
      incomeB: b.income,
      expenseB: b.expense,
      savingsRateB:
        b.income > 0 ? ((b.income - b.expense) / b.income) * 100 : 0,
    };
  });
};

// ── Month-vs-Month comparison ──

export interface MonthComparisonPoint {
  label: string; // e.g. "2024-06" or "2025-01"
  income: number;
  expense: number;
  savingsRate: number;
}

/**
 * Build a 2-point comparison for two specific months.
 */
export const buildMonthVsMonthData = (
  labelA: string,
  monthA: MonthlyData | undefined,
  labelB: string,
  monthB: MonthlyData | undefined,
): MonthComparisonPoint[] => {
  const a = monthA ?? { income: 0, expense: 0 };
  const b = monthB ?? { income: 0, expense: 0 };
  return [
    {
      label: labelA,
      income: a.income,
      expense: a.expense,
      savingsRate:
        a.income > 0 ? ((a.income - a.expense) / a.income) * 100 : 0,
    },
    {
      label: labelB,
      income: b.income,
      expense: b.expense,
      savingsRate:
        b.income > 0 ? ((b.income - b.expense) / b.income) * 100 : 0,
    },
  ];
};
