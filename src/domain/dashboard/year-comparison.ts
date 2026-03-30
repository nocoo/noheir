import type { YearlyComparison } from "../types";

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
