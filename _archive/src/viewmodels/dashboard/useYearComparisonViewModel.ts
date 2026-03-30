import { useMemo } from 'react';
import type { YearlyComparison } from '@/types/transaction';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { buildYearComparisonChartData } from '@/domain/dashboard/yearComparison';

interface YearComparisonViewModelParams {
  data: YearlyComparison[];
}

export function useYearComparisonViewModel({ data }: YearComparisonViewModelParams) {
  const { settings } = useSettings();
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);
  const targetSavingsRate = settings.targetSavingsRate;

  const chartData = useMemo(
    () => buildYearComparisonChartData(data),
    [data]
  );

  const targetLineColor = '#059669';

  return {
    incomeColorHex,
    expenseColorHex,
    targetSavingsRate,
    chartData,
    targetLineColor,
  };
}
