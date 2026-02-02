import { useMemo } from 'react';
import type { MonthlyData, Transaction } from '@/types/transaction';
import {
  buildFinancialHealthResult,
  buildSafeMonthlyData,
  buildSafeTotalIncome,
} from '@/domain/dashboard/financialHealth';

interface FinancialHealthViewModelParams {
  transactions: Transaction[];
  totalIncome: number;
  monthlyData: MonthlyData[];
  fixedExpenseCategories: string[];
}

export function useFinancialHealthViewModel({
  transactions,
  totalIncome,
  monthlyData,
  fixedExpenseCategories,
}: FinancialHealthViewModelParams) {
  const safeMonthlyData = useMemo(
    () => buildSafeMonthlyData(monthlyData),
    [monthlyData]
  );

  const safeTotalIncome = useMemo(
    () => buildSafeTotalIncome(totalIncome),
    [totalIncome]
  );

  const healthResult = useMemo(
    () => buildFinancialHealthResult(
      transactions,
      safeMonthlyData,
      safeTotalIncome,
      fixedExpenseCategories
    ),
    [transactions, safeMonthlyData, safeTotalIncome, fixedExpenseCategories]
  );

  return {
    safeMonthlyData,
    safeTotalIncome,
    healthResult,
  };
}
