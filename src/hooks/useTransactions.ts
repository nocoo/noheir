import { useState, useMemo, useCallback, useEffect } from 'react';
import { Transaction, CategorySummary, MonthlyData, YearlyComparison } from '@/types/transaction';
import {
  ParsedTransaction,
  DataQualityMetrics,
  TransactionValidation
} from '@/types/data';
import { DataLayerManager, createDataLayerManager } from '@/lib/dataLayer';
import { parseCSVFile } from '@/lib/csvParser';
import { useSupabaseTransactions } from '@/hooks/useSupabaseTransactions';
import { useAuth } from '@/contexts/AuthContext';

// Re-export StoredYearData type for components
export interface StoredYearData {
  year: number;
  transactions: Transaction[];
  recordCount: number;
  importedAt: string;
  updatedAt: string;
  metadata: {
    fileName?: string;
    fileSize?: number;
    totalIncome: number;
    totalExpense: number;
  };
}

export function useTransactions() {
  const { user } = useAuth();
  const supabaseTx = useSupabaseTransactions();
  const manager = useMemo(() => createDataLayerManager(), []);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [storedYearsData, setStoredYearsData] = useState<StoredYearData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [comparisonYears, setComparisonYears] = useState<number[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<TransactionValidation[] | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<DataQualityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from Supabase with incremental strategy
  const loadStoredData = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setStoredYearsData([]);
      setSelectedYear(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Load latest year only for fast initial render
      const latestData = await supabaseTx.loadLatestYearOnly();

      if (!latestData) {
        // No data at all
        setTransactions([]);
        setStoredYearsData([]);
        setSelectedYear(null);
        setIsLoading(false);
        return;
      }

      const { year: latestYear, transactions: latestTransactions } = latestData;

      // Set up initial state with latest year
      setSelectedYear(latestYear);
      setTransactions(latestTransactions);

      const initialStoredData: StoredYearData[] = [{
        year: latestYear,
        transactions: latestTransactions,
        recordCount: latestTransactions.length,
        importedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          totalIncome: latestTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
          totalExpense: latestTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
        },
      }];
      setStoredYearsData(initialStoredData);

      // Set loading to false now so UI renders quickly
      setIsLoading(false);

      // Step 2: Load remaining years in background
      setTimeout(async () => {
        try {
          const remainingData = await supabaseTx.loadRemainingYears(latestYear);

          // Merge with initial data
          const allData = [...initialStoredData, ...remainingData];
          const allTransactions = allData.flatMap(d => d.transactions);

          setStoredYearsData(allData);
          setTransactions(allTransactions);

          // Update comparison years if not set
          if (comparisonYears.length === 0) {
            const years = allData.map(d => d.year).sort((a, b) => b - a);
            setComparisonYears(years.slice(0, 2));
          }
        } catch (error) {
          console.error('Failed to load remaining years:', error);
          // Don't throw - we already have the latest year displayed
        }
      }, 100);

    } catch (error) {
      console.error('Failed to load data from Supabase:', error);
      setTransactions([]);
      setStoredYearsData([]);
      setSelectedYear(null);
      setIsLoading(false);
    }
  }, [user, supabaseTx, comparisonYears.length]);

  // Load data on mount and when user changes
  useEffect(() => {
    loadStoredData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Load data from CSV file and upload to Supabase
  const loadFromFile = useCallback(async (file: File): Promise<{
    success: boolean;
    transactions: ParsedTransaction[];
    errors: Array<{ row: number; message: string; data: string[] }>;
    warnings: Array<{ row: number; message: string }>;
  }> => {
    setIsValidating(true);

    try {
      const result = await parseCSVFile(file);

      if (result.transactions.length === 0) {
        return result;
      }

      // Load into data layer manager for validation
      manager.loadRaw(result.transactions);
      const validations = manager.validate();
      setValidationResults(validations);

      const metrics = manager.getMetrics();
      setQualityMetrics(metrics);

      return result;
    } catch (error) {
      console.error('Failed to load CSV file:', error);
      throw error;
    } finally {
      setIsValidating(false);
    }
  }, [manager]);

  // Delete a year's data
  const deleteYearData = useCallback(async (year: number) => {
    try {
      await supabaseTx.deleteYearData(year);
      await loadStoredData();
    } catch (error) {
      console.error('Failed to delete year data:', error);
      throw error;
    }
  }, [supabaseTx, loadStoredData]);

  // Clear all data
  const clearAll = useCallback(async () => {
    try {
      await supabaseTx.clearAllData();
      await loadStoredData();
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }, [supabaseTx, loadStoredData]);

  // Export data (convert to CSV)
  const exportData = useCallback(async () => {
    try {
      // Get all transactions from Supabase
      const allData = await supabaseTx.loadAllYears();
      const allTransactions = allData.flatMap(d => d.transactions);

      if (allTransactions.length === 0) {
        throw new Error('没有数据可以导出');
      }

      // Convert to CSV format
      const headers = ['日期', '交易分类', '交易类型', '流入金额', '流出金额', '币种', '资金账户', '标签', '备注'];
      const rows = allTransactions.map(t => {
        let inflow = '0.00';
        let outflow = '0.00';

        if (t.type === 'income') {
          inflow = t.amount.toFixed(2);
        } else if (t.type === 'expense') {
          outflow = t.amount.toFixed(2);
        }

        return [
          t.date,
          t.primaryCategory,
          t.tertiaryCategory,
          inflow,
          outflow,
          '人民币',
          t.account,
          '',
          t.description || ''
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }, [supabaseTx]);

  // Get quality metrics for a specific year
  const getQualityForYear = useCallback(async (year: number) => {
    const yearData = storedYearsData.find(d => d.year === year);
    if (!yearData) return null;

    // Convert Transaction to ParsedTransaction for validation
    const parsedTransactions: ParsedTransaction[] = yearData.transactions.map((t, idx) => ({
      id: t.id,
      date: t.date,
      year: t.year,
      month: t.month,
      day: new Date(t.date).getDate(),
      primaryCategory: t.primaryCategory,
      secondaryCategory: t.secondaryCategory,
      tertiaryCategory: t.tertiaryCategory,
      amount: t.amount,
      type: t.type,
      account: t.account,
      currency: 'CNY',
      tags: [],
      note: t.description,
      rawIndex: idx,
      hasSecondaryMapping: true
    }));

    // Validate
    manager.loadRaw(parsedTransactions);
    const validations = manager.validate();
    const metrics = manager.getMetrics();

    return {
      year,
      metrics,
      validations
    };
  }, [storedYearsData, manager]);

  // Get available years from stored data
  const availableYears = useMemo(() => {
    return storedYearsData.map(d => d.year).sort((a, b) => b - a);
  }, [storedYearsData]);

  // Filter transactions by selected year
  const filteredTransactions = useMemo(() => {
    if (selectedYear === null) return [];
    return transactions.filter(t => t.year === selectedYear);
  }, [transactions, selectedYear]);

  // Monthly data for selected year
  const monthlyData: MonthlyData[] = useMemo(() => {
    if (selectedYear === null) return [];
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    return months.map((month, index) => {
      const monthTransactions = filteredTransactions.filter(t => t.month === index + 1);
      const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return { month, income, expense, balance: income - expense };
    });
  }, [filteredTransactions, selectedYear]);

  // Category breakdown for selected year
  const categoryData: CategorySummary[] = useMemo(() => {
    if (selectedYear === null) return [];
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);

    const categoryMap = new Map<string, { total: number; subcategories: Map<string, number> }>();

    expenses.forEach(t => {
      if (!categoryMap.has(t.primaryCategory)) {
        categoryMap.set(t.primaryCategory, { total: 0, subcategories: new Map() });
      }
      const cat = categoryMap.get(t.primaryCategory)!;
      cat.total += t.amount;
      cat.subcategories.set(t.secondaryCategory, (cat.subcategories.get(t.secondaryCategory) || 0) + t.amount);
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      total: data.total,
      percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0,
      subcategories: Array.from(data.subcategories.entries()).map(([name, total]) => ({ name, total }))
    })).sort((a, b) => b.total - a.total);
  }, [filteredTransactions, selectedYear]);

  // Yearly comparison
  const yearlyComparison: YearlyComparison[] = useMemo(() => {
    return comparisonYears
      .map(year => {
        const yearTransactions = transactions.filter(t => t.year === year);
        const totalIncome = yearTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = yearTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

        const expenses = yearTransactions.filter(t => t.type === 'expense');
        const categoryMap = new Map<string, number>();
        expenses.forEach(t => {
          categoryMap.set(t.primaryCategory, (categoryMap.get(t.primaryCategory) || 0) + t.amount);
        });

        return {
          year,
          totalIncome,
          totalExpense,
          balance: totalIncome - totalExpense,
          categoryBreakdown: Array.from(categoryMap.entries()).map(([category, total]) => ({
            category,
            total,
            percentage: totalExpense > 0 ? (total / totalExpense) * 100 : 0,
            subcategories: []
          }))
        };
      })
      .sort((a, b) => a.year - b.year); // Sort by year ascending
  }, [transactions, comparisonYears]);

  // Summary statistics
  const totalIncome = useMemo(() =>
    filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const totalExpense = useMemo(() =>
    filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  // Transfer transactions for selected year
  const transferTransactions = useMemo(() =>
    filteredTransactions.filter(t => t.type === 'transfer'),
    [filteredTransactions]
  );

  return {
    // Data
    transactions: filteredTransactions,
    allTransactions: transactions,
    transferTransactions,
    monthlyData,
    categoryData,
    yearlyComparison,

    // Statistics
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,

    // Selection
    selectedYear,
    setSelectedYear,
    comparisonYears,
    setComparisonYears,
    availableYears,

    // Data management
    loadFromFile,
    loadStoredData,
    deleteYearData,
    clearAll,
    exportData,
    storedYearsData,
    getQualityForYear,

    // Loading state
    isLoading,

    // Validation state
    isValidating,
    validationResults,
    qualityMetrics,
  };
}
