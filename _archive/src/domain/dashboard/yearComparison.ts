import type { YearlyComparison } from '@/types/transaction';

export interface YearComparisonChartPoint {
  year: string;
  收入: number;
  支出: number;
  结余: number;
  储蓄率: number;
}

export const buildYearComparisonChartData = (data: YearlyComparison[]): YearComparisonChartPoint[] => {
  return data.map(item => {
    const savingsRate = item.totalIncome > 0
      ? ((item.totalIncome - item.totalExpense) / item.totalIncome) * 100
      : 0;
    return {
      year: item.year.toString(),
      收入: item.totalIncome,
      支出: item.totalExpense,
      结余: item.balance,
      储蓄率: savingsRate,
    };
  });
};
