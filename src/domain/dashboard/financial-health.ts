import type { DomainTransaction, MonthlyData } from "../types";
import { calculateFinancialHealth } from "@/lib/financial-health-algorithm";

export const buildSafeMonthlyData = (monthlyData: MonthlyData[]): MonthlyData[] => {
  return Array.isArray(monthlyData) ? monthlyData : [];
};

export const buildSafeTotalIncome = (totalIncome: number): number => {
  return Number.isFinite(totalIncome) ? totalIncome : 0;
};

export const buildFinancialHealthResult = (
  transactions: DomainTransaction[] | undefined,
  monthlyData: MonthlyData[],
  totalIncome: number,
  fixedExpenseCategories: string[],
) => {
  return calculateFinancialHealth(transactions, monthlyData, totalIncome, fixedExpenseCategories);
};
