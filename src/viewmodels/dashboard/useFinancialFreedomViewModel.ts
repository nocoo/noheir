import { useMemo, useState } from 'react';
import type { Transaction } from '@/types/transaction';
import { useSettings } from '@/contexts/SettingsContext';
import {
  buildFreedomSummary,
  buildIncomeBreakdown,
  buildIncreaseIncomeScenario,
  buildReduceExpenseScenario,
  buildTotalExpense,
} from '@/domain/dashboard/financialFreedom';

interface FinancialFreedomViewModelParams {
  transactions: Transaction[];
  year: number | null;
}

export function useFinancialFreedomViewModel({ transactions, year }: FinancialFreedomViewModelParams) {
  const { settings } = useSettings();
  const activeIncomeCategories = useMemo(
    () => settings.activeIncomeCategories || [],
    [settings.activeIncomeCategories]
  );
  const [expenseReductionPercent, setExpenseReductionPercent] = useState(20);
  const [passiveIncomeIncreasePercent, setPassiveIncomeIncreasePercent] = useState(50);

  const incomeBreakdown = useMemo(
    () => buildIncomeBreakdown(transactions, activeIncomeCategories),
    [transactions, activeIncomeCategories]
  );

  const totalExpense = useMemo(
    () => buildTotalExpense(transactions),
    [transactions]
  );

  const freedomSummary = useMemo(
    () => buildFreedomSummary(totalExpense, incomeBreakdown.passiveIncome),
    [totalExpense, incomeBreakdown.passiveIncome]
  );

  const scenario1 = useMemo(
    () => buildReduceExpenseScenario(totalExpense, incomeBreakdown.passiveIncome, expenseReductionPercent),
    [totalExpense, incomeBreakdown.passiveIncome, expenseReductionPercent]
  );

  const scenario2 = useMemo(
    () => buildIncreaseIncomeScenario(totalExpense, incomeBreakdown.passiveIncome, passiveIncomeIncreasePercent),
    [totalExpense, incomeBreakdown.passiveIncome, passiveIncomeIncreasePercent]
  );

  return {
    year,
    activeIncomeCategories,
    incomeBreakdown,
    totalExpense,
    freedomSummary,
    expenseReductionPercent,
    setExpenseReductionPercent,
    passiveIncomeIncreasePercent,
    setPassiveIncomeIncreasePercent,
    scenario1,
    scenario2,
  };
}
