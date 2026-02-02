import { useMemo, useState } from 'react';
import type { Transaction } from '@/types/transaction';
import { useSettings } from '@/contexts/SettingsContext';
import { useTransfers } from '@/hooks/useTransfers';
import {
  buildAccountDetailData,
  buildAccountType,
  buildAccountsByType,
  buildBalanceEntries,
  buildUniqueAccounts,
  sortDisplayEntries,
} from '@/domain/dashboard/accountDetail';

interface AccountDetailViewModelParams {
  transactions: Transaction[];
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
}

export function useAccountDetailViewModel({
  transactions: allTransactions,
  selectedYear,
  availableYears,
  onYearChange,
}: AccountDetailViewModelParams) {
  const { settings } = useSettings();
  const { transfers } = useTransfers();
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<'date' | 'primaryCategory' | 'type' | 'amount' | 'balanceAfter'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const transactions = useMemo(
    () => allTransactions.filter(t => t.year === selectedYear),
    [allTransactions, selectedYear]
  );

  const allBalanceEntries = useMemo(
    () => buildBalanceEntries(allTransactions, transfers || []),
    [allTransactions, transfers]
  );

  const uniqueAccounts = useMemo(
    () => buildUniqueAccounts(allBalanceEntries),
    [allBalanceEntries]
  );

  const accountsByType = useMemo(
    () => buildAccountsByType(uniqueAccounts, settings.accountTypes),
    [uniqueAccounts, settings.accountTypes]
  );

  const { dailyBalances, displayEntries, summary, displayAnchors } = useMemo(
    () => buildAccountDetailData(
      allBalanceEntries,
      selectedAccount,
      selectedYear,
      settings.balanceAnchors
    ),
    [allBalanceEntries, selectedAccount, selectedYear, settings.balanceAnchors]
  );

  const accountType = useMemo(
    () => buildAccountType(selectedAccount, settings.accountTypes),
    [selectedAccount, settings.accountTypes]
  );

  const sortedDisplayEntries = useMemo(
    () => sortDisplayEntries(displayEntries, sortColumn, sortDirection),
    [displayEntries, sortColumn, sortDirection]
  );

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortColumn(column);
    setSortDirection(column === 'amount' || column === 'balanceAfter' ? 'desc' : 'asc');
  };

  return {
    settings,
    transfers,
    availableYears,
    onYearChange,
    selectedYear,
    transactions,
    selectedAccount,
    setSelectedAccount,
    sortColumn,
    sortDirection,
    handleSort,
    allBalanceEntries,
    uniqueAccounts,
    accountsByType,
    dailyBalances,
    displayEntries,
    sortedDisplayEntries,
    summary,
    displayAnchors,
    accountType,
  };
}
