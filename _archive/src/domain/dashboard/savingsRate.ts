import type { MonthlyData } from '@/types/transaction';

export interface SavingsRateChartPoint extends MonthlyData {
  savingsRate: number;
  savings: number;
}

export interface SavingsRateSummary {
  totalIncome: number;
  totalExpense: number;
  totalSavings: number;
  annualSavingsRate: number;
  savingsRateDiff: number;
  savingsGap: number;
  bestMonth: SavingsRateChartPoint | null;
  worstMonth: SavingsRateChartPoint | null;
}

export const buildSavingsRateChartData = (data: MonthlyData[]) => {
  const chartData: SavingsRateChartPoint[] = data.map(item => ({
    ...item,
    savingsRate: item.income > 0 ? ((item.income - item.expense) / item.income) * 100 : 0,
    savings: item.income - item.expense,
  }));

  const totalIncome = chartData.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = chartData.reduce((sum, d) => sum + d.expense, 0);
  const totalSavings = totalIncome - totalExpense;
  const annualSavingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  const bestMonth = chartData.length > 0
    ? chartData.reduce((best, curr) => curr.savingsRate > best.savingsRate ? curr : best, chartData[0])
    : null;

  const worstMonth = chartData.length > 0
    ? chartData.reduce((worst, curr) =>
      curr.income > 0 && curr.savingsRate < worst.savingsRate ? curr : worst,
      chartData.find(d => d.income > 0) || chartData[0]
    )
    : null;

  return {
    chartData,
    totals: {
      totalIncome,
      totalExpense,
      totalSavings,
      annualSavingsRate,
      bestMonth,
      worstMonth,
    },
  };
};

export const buildSavingsRateSummary = (
  totals: {
    totalIncome: number;
    totalExpense: number;
    totalSavings: number;
    annualSavingsRate: number;
    bestMonth: SavingsRateChartPoint | null;
    worstMonth: SavingsRateChartPoint | null;
  },
  targetSavingsRate: number
): SavingsRateSummary => {
  const savingsRateDiff = totals.annualSavingsRate - targetSavingsRate;
  const savingsGap = totals.totalIncome * (savingsRateDiff / 100);

  return {
    totalIncome: totals.totalIncome,
    totalExpense: totals.totalExpense,
    totalSavings: totals.totalSavings,
    annualSavingsRate: totals.annualSavingsRate,
    savingsRateDiff,
    savingsGap,
    bestMonth: totals.bestMonth,
    worstMonth: totals.worstMonth,
  };
};
