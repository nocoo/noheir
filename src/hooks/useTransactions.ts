import { useState, useMemo, useCallback, useEffect } from 'react';
import { Transaction, CategorySummary, MonthlyData, YearlyComparison } from '@/types/transaction';
import {
  CleanedTransaction,
  ParsedTransaction,
  DataQualityMetrics,
  TransactionValidation
} from '@/types/data';
import { createDataLayerManager, DataLayerManager } from '@/lib/dataLayer';
import { parseCSVFile } from '@/lib/csvParser';
import {
  saveTransactionsForYear,
  getAllStoredYears,
  getTransactionsForYear,
  deleteYear,
  clearAllData,
  exportAllData,
  importData,
  StoredYearData
} from '@/lib/storage';

// Convert CleanedTransaction to Transaction for backward compatibility
function toTransaction(ct: CleanedTransaction): Transaction {
  return {
    id: ct.id,
    date: ct.date,
    year: ct.year,
    month: ct.month,
    primaryCategory: ct.primaryCategory,
    secondaryCategory: ct.secondaryCategory,
    tertiaryCategory: ct.tertiaryCategory,
    amount: ct.amount,
    account: ct.account,
    description: ct.note,
    type: ct.type
  };
}

export function useTransactions() {
  const manager = useMemo(() => createDataLayerManager(), []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [storedYearsData, setStoredYearsData] = useState<StoredYearData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [comparisonYears, setComparisonYears] = useState<number[]>([2023, 2024]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<TransactionValidation[] | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<DataQualityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load all stored years data on mount
  useEffect(() => {
    loadStoredData();
  }, []);

  // Load data from IndexedDB
  const loadStoredData = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedData = await getAllStoredYears();
      setStoredYearsData(storedData);

      // Flatten all transactions
      const allTransactions = storedData.flatMap(d => d.transactions);
      setTransactions(allTransactions);

      // Set selected year to most recent if available
      if (storedData.length > 0) {
        const years = storedData.map(d => d.year).sort((a, b) => b - a);
        setSelectedYear(years[0]);
      }
    } catch (error) {
      console.error('Failed to load stored data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data from CSV file and save to IndexedDB
  const loadFromFile = useCallback(async (file: File): Promise<{
    success: boolean;
    transactions: ParsedTransaction[];
    errors: Array<{ row: number; message: string; data: string[] }>;
    warnings: Array<{ row: number; message: string }>;
  }> => {
    setIsValidating(true);

    try {
      const result = await parseCSVFile(file);

      if (result.transactions.length > 0) {
        // Load into data layer manager
        manager.loadRaw(result.transactions);

        // Validate
        const validations = manager.validate();
        setValidationResults(validations);

        const metrics = manager.getMetrics();
        setQualityMetrics(metrics);

        // Clean and convert to Transaction format
        const cleaned = manager.clean({
          includeCritical: false,
          includeErrors: true,
          includeWarnings: true
        });

        const transactionList = cleaned.map(toTransaction);

        // Determine year from transactions
        const year = transactionList[0]?.year || new Date().getFullYear();

        // Save to IndexedDB (replaces existing data for this year)
        await saveTransactionsForYear(year, transactionList, {
          fileName: file.name,
          fileSize: file.size
        });

        // Reload stored data
        await loadStoredData();

        // Set selected year
        setSelectedYear(year);
      }

      return {
        success: result.transactions.length > 0,
        transactions: result.transactions,
        errors: result.errors,
        warnings: result.warnings
      };
    } catch (error) {
      console.error('Failed to load CSV file:', error);
      throw error;
    } finally {
      setIsValidating(false);
    }
  }, [manager, loadStoredData]);

  // Delete a year's data
  const deleteYearData = useCallback(async (year: number) => {
    try {
      await deleteYear(year);
      await loadStoredData();

      // Update selected year if needed
      const remainingYears = storedYearsData.filter(d => d.year !== year).map(d => d.year);
      if (year === selectedYear && remainingYears.length > 0) {
        setSelectedYear(Math.max(...remainingYears));
      }
    } catch (error) {
      console.error('Failed to delete year data:', error);
      throw error;
    }
  }, [selectedYear, storedYearsData, loadStoredData]);

  // Clear all data
  const clearAll = useCallback(async () => {
    try {
      await clearAllData();
      await loadStoredData();
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }, [loadStoredData]);

  // Export data
  const exportData = useCallback(async () => {
    try {
      const jsonData = await exportAllData();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }, []);

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
      amount: t.amount,
      type: t.type,
      account: t.account,
      currency: 'CNY',
      tags: [],
      note: t.description,
      rawIndex: idx
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
    return transactions.filter(t => t.year === selectedYear);
  }, [transactions, selectedYear]);

  // Monthly data for selected year
  const monthlyData: MonthlyData[] = useMemo(() => {
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    return months.map((month, index) => {
      const monthTransactions = filteredTransactions.filter(t => t.month === index + 1);
      const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return { month, income, expense, balance: income - expense };
    });
  }, [filteredTransactions]);

  // Category breakdown for selected year
  const categoryData: CategorySummary[] = useMemo(() => {
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
  }, [filteredTransactions]);

  // Yearly comparison
  const yearlyComparison: YearlyComparison[] = useMemo(() => {
    return comparisonYears.map(year => {
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
    });
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
    transferTransactions, // Transfer transactions for analysis
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
