import type { MonthlyData, Transaction } from '@/types/transaction';
import { calculateFinancialHealth } from '@/lib/financial-health-algorithm';

export const buildSafeMonthlyData = (monthlyData: MonthlyData[]) => {
  return Array.isArray(monthlyData) ? monthlyData : [];
};

export const buildSafeTotalIncome = (totalIncome: number) => {
  return Number.isFinite(totalIncome) ? totalIncome : 0;
};

export const buildFinancialHealthResult = (
  transactions: Transaction[] | undefined,
  monthlyData: MonthlyData[],
  totalIncome: number,
  fixedExpenseCategories: string[]
) => {
  return calculateFinancialHealth(transactions, monthlyData, totalIncome, fixedExpenseCategories);
};
