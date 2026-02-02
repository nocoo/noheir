import { useMemo } from 'react';
import type { Transaction } from '@/types/transaction';
import { buildFlowTabs, buildFlowTitle, buildFlowTransactions } from '@/domain/dashboard/flowAnalysis';

interface FlowAnalysisViewModelParams {
  transactions: Transaction[];
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

export function useFlowAnalysisViewModel({
  transactions,
  selectedYear,
  availableYears,
  onYearChange,
}: FlowAnalysisViewModelParams) {
  const tabs = useMemo(() => buildFlowTabs(), []);
  const title = useMemo(() => buildFlowTitle(), []);
  const flowTransactions = useMemo(() => buildFlowTransactions(transactions), [transactions]);

  return {
    tabs,
    title,
    flowTransactions,
    selectedYear,
    availableYears,
    onYearChange,
  };
}
