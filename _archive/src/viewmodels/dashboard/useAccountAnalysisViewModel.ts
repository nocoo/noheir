import { useMemo, useState } from 'react';
import type { Transaction } from '@/types/transaction';
import { useSettings } from '@/contexts/SettingsContext';
import {
  buildAccountData,
  buildAccountGroups,
  buildAccountSummaryStats,
  buildChartData,
  buildMonthlyByAccount,
  buildPieData,
  buildTopTransactionCounts,
  GroupByType,
} from '@/domain/dashboard/accountAnalysis';

interface AccountAnalysisViewModelParams {
  transactions: Transaction[];
}

export function useAccountAnalysisViewModel({ transactions }: AccountAnalysisViewModelParams) {
  const { settings } = useSettings();
  const [groupBy, setGroupBy] = useState<GroupByType>('type');

  const accountData = useMemo(
    () => buildAccountData(transactions),
    [transactions]
  );

  const accountGroups = useMemo(
    () => buildAccountGroups(accountData, groupBy, settings.accountTypes),
    [accountData, groupBy, settings.accountTypes]
  );

  const chartData = useMemo(
    () => buildChartData(accountData),
    [accountData]
  );

  const pieData = useMemo(
    () => buildPieData(accountData),
    [accountData]
  );

  const monthlyByAccount = useMemo(
    () => buildMonthlyByAccount(transactions),
    [transactions]
  );

  const topTransactionCounts = useMemo(
    () => buildTopTransactionCounts(accountData),
    [accountData]
  );

  const summaryStats = useMemo(
    () => buildAccountSummaryStats(accountData, transactions),
    [accountData, transactions]
  );

  return {
    settings,
    groupBy,
    setGroupBy,
    accountData,
    accountGroups,
    chartData,
    pieData,
    monthlyByAccount,
    topTransactionCounts,
    summaryStats,
  };
}
