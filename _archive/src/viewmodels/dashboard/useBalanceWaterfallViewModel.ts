import { useMemo } from 'react';
import type { MonthlyData } from '@/types/transaction';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { buildBalanceWaterfallData } from '@/domain/dashboard/balanceWaterfall';

interface BalanceWaterfallViewModelParams {
  data: MonthlyData[];
}

export function useBalanceWaterfallViewModel({ data }: BalanceWaterfallViewModelParams) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  const { waterfallData, cumulativeBalance } = useMemo(
    () => buildBalanceWaterfallData(data),
    [data]
  );

  return {
    incomeColorClass,
    incomeColorHex,
    expenseColorClass,
    expenseColorHex,
    waterfallData,
    cumulativeBalance,
  };
}
