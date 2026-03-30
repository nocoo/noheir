import { useMemo } from 'react';
import { buildSavingsRate } from '@/domain/dashboard/overview';
import type { Transaction } from '@/types/transaction';

interface OverviewViewModelParams {
  transactions: Transaction[];
  monthlyData: { month: string; income: number; expense: number; balance: number }[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
  selectedYear: number | null;
  availableYears: number[];
  onYearChange: (year: number | null) => void;
  targetSavingsRate: number;
}

export function useOverviewViewModel({
  transactions,
  monthlyData,
  totalIncome,
  totalExpense,
  balance,
  selectedYear,
  availableYears,
  onYearChange,
  targetSavingsRate,
}: OverviewViewModelParams) {
  const savingsRate = useMemo(
    () => buildSavingsRate(totalIncome, totalExpense),
    [totalIncome, totalExpense]
  );

  return {
    transactions,
    monthlyData,
    totalIncome,
    totalExpense,
    balance,
    selectedYear,
    availableYears,
    onYearChange,
    targetSavingsRate,
    savingsRate,
  };
}
