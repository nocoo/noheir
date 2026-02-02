import { useMemo } from 'react';
import type { MonthlyData, Transaction } from '@/types/transaction';
import {
  buildAverageMonthly,
  buildFilteredTransactions,
  buildMonthlyFiltered,
  buildTopTransactions,
  buildTotalAmount,
  buildTransactionLabels,
  TransactionType,
} from '@/domain/dashboard/transactionAnalysis';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TransactionAnalysisViewModelParams {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
  type: TransactionType;
}

export function useTransactionAnalysisViewModel({
  transactions,
  monthlyData,
  type,
}: TransactionAnalysisViewModelParams) {
  const { settings } = useSettings();
  const isIncome = type === 'income';

  const colorHex = isIncome ? getIncomeColorHex(settings.colorScheme) : getExpenseColorHex(settings.colorScheme);
  const colorClass = isIncome ? getIncomeColor(settings.colorScheme) : getExpenseColor(settings.colorScheme);
  const variant: 'income' | 'expense' = isIncome ? 'income' : 'expense';
  const icon = isIncome ? TrendingUp : TrendingDown;

  const filteredTransactions = useMemo(
    () => buildFilteredTransactions(transactions, type),
    [transactions, type]
  );

  const totalAmount = useMemo(
    () => buildTotalAmount(filteredTransactions),
    [filteredTransactions]
  );

  const topTransactions = useMemo(
    () => buildTopTransactions(filteredTransactions, 50),
    [filteredTransactions]
  );

  const monthlyFiltered = useMemo(
    () => buildMonthlyFiltered(monthlyData, type),
    [monthlyData, type]
  );

  const avgMonthly = useMemo(
    () => buildAverageMonthly(monthlyFiltered, type),
    [monthlyFiltered, type]
  );

  const labels = useMemo(
    () => buildTransactionLabels(type),
    [type]
  );

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  return {
    settings,
    isIncome,
    colorHex,
    colorClass,
    variant,
    icon,
    filteredTransactions,
    totalAmount,
    topTransactions,
    monthlyFiltered,
    avgMonthly,
    labels,
    colors,
  };
}
