import type { StoredYearData } from '@/hooks/useTransactions';
import type { StoredTransferYearData } from '@/hooks/useTransfers';

export type YearDataStatus = {
  year: number;
  hasTransactions: boolean;
  hasTransfers: boolean;
  isComplete: boolean;
  missing: string[];
};

export const buildYearStatusMap = (
  storedYearsData: StoredYearData[],
  transferYearsData: StoredTransferYearData[]
) => {
  const statusMap = new Map<number, YearDataStatus>();

  storedYearsData.forEach(yearData => {
    statusMap.set(yearData.year, {
      year: yearData.year,
      hasTransactions: true,
      hasTransfers: false,
      isComplete: false,
      missing: ['转账数据'],
    });
  });

  transferYearsData.forEach(transferYear => {
    const existing = statusMap.get(transferYear.year);
    if (existing) {
      statusMap.set(transferYear.year, {
        year: transferYear.year,
        hasTransactions: true,
        hasTransfers: true,
        isComplete: true,
        missing: [],
      });
    } else {
      statusMap.set(transferYear.year, {
        year: transferYear.year,
        hasTransactions: false,
        hasTransfers: true,
        isComplete: false,
        missing: ['收支流水'],
      });
    }
  });

  return statusMap;
};

export const getAllYears = (statusMap: Map<number, YearDataStatus>) => {
  return Array.from(statusMap.values()).sort((a, b) => b.year - a.year);
};

export const calculateTotals = (storedYearsData: StoredYearData[], transferYearsData: StoredTransferYearData[]) => {
  const totalRecords = storedYearsData.reduce((sum, d) => sum + d.recordCount, 0);
  const totalIncome = storedYearsData.reduce((sum, d) => sum + d.metadata.totalIncome, 0);
  const totalExpense = storedYearsData.reduce((sum, d) => sum + d.metadata.totalExpense, 0);
  const totalTransferRecords = transferYearsData.reduce((sum, d) => sum + d.recordCount, 0);

  return { totalRecords, totalIncome, totalExpense, totalTransferRecords };
};

export const formatImportDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
