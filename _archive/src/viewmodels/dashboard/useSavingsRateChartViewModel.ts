import { useMemo } from 'react';
import type { MonthlyData } from '@/types/transaction';
import {
  getIncomeColorHex,
  getExpenseColorHex,
  getSavingsRateColor,
  getSavingsRateStatus,
} from '@/contexts/SettingsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { buildSavingsRateChartData, buildSavingsRateSummary } from '@/domain/dashboard/savingsRate';

interface SavingsRateChartViewModelParams {
  data: MonthlyData[];
}

export function useSavingsRateChartViewModel({ data }: SavingsRateChartViewModelParams) {
  const { settings } = useSettings();
  const targetSavingsRate = settings.targetSavingsRate;
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  const { chartData, totals } = useMemo(
    () => buildSavingsRateChartData(data),
    [data]
  );

  const summary = useMemo(
    () => buildSavingsRateSummary(totals, targetSavingsRate),
    [totals, targetSavingsRate]
  );

  const savingsRateStatus = getSavingsRateStatus(summary.annualSavingsRate, targetSavingsRate);
  const savingsRateColorClass = getSavingsRateColor(savingsRateStatus);

  return {
    targetSavingsRate,
    incomeColorHex,
    expenseColorHex,
    chartData,
    summary,
    savingsRateStatus,
    savingsRateColorClass,
  };
}
