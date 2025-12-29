import { useState, useMemo, useCallback } from 'react';
import { Transaction, CategorySummary, MonthlyData, YearlyComparison } from '@/types/transaction';
import {
  CleanedTransaction,
  ParsedTransaction,
  DataQualityMetrics,
  TransactionValidation
} from '@/types/data';
import { createDataLayerManager, DataLayerManager } from '@/lib/dataLayer';
import { parseCSVFile } from '@/lib/csvParser';

// Convert CleanedTransaction to Transaction for backward compatibility
function toTransaction(ct: CleanedTransaction): Transaction {
  return {
    id: ct.id,
    date: ct.date,
    year: ct.year,
    month: ct.month,
    primaryCategory: ct.primaryCategory,
    secondaryCategory: ct.secondaryCategory,
    amount: ct.amount,
    account: ct.account,
    description: ct.note,
    type: ct.type
  };
}

// Sample data for initial demonstration
const sampleTransactions: Transaction[] = [
  { id: '1', date: '2024-01-15', year: 2024, month: 1, primaryCategory: '餐饮', secondaryCategory: '外卖', amount: 85, account: '微信', type: 'expense' },
  { id: '2', date: '2024-01-20', year: 2024, month: 1, primaryCategory: '交通', secondaryCategory: '地铁', amount: 50, account: '支付宝', type: 'expense' },
  { id: '3', date: '2024-02-05', year: 2024, month: 2, primaryCategory: '收入', secondaryCategory: '工资', amount: 15000, account: '银行卡', type: 'income' },
  { id: '4', date: '2024-02-10', year: 2024, month: 2, primaryCategory: '购物', secondaryCategory: '服装', amount: 500, account: '信用卡', type: 'expense' },
  { id: '5', date: '2024-03-01', year: 2024, month: 3, primaryCategory: '住房', secondaryCategory: '房租', amount: 3500, account: '银行卡', type: 'expense' },
];

export function useTransactions() {
  const manager = useMemo(() => createDataLayerManager(), []);
  const [transactions, setTransactions] = useState<Transaction[]>(sampleTransactions);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [comparisonYears, setComparisonYears] = useState<number[]>([2023, 2024]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<TransactionValidation[] | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<DataQualityMetrics | null>(null);

  // Load data from CSV file
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
        setTransactions(transactionList);

        // Update selected year to available data
        const years = metrics?.years || [2024];
        setSelectedYear(years[0]);
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
  }, [manager]);

  // Add transactions
  const addTransactions = useCallback((newTransactions: Transaction[]) => {
    setTransactions(prev => [...prev, ...newTransactions]);
  }, []);

  // Clear all transactions
  const clearTransactions = useCallback(() => {
    setTransactions(sampleTransactions);
    setValidationResults(null);
    setQualityMetrics(null);
    manager.reset();
  }, [manager]);

  // Get available years
  const availableYears = useMemo(() => {
    const years = [...new Set(transactions.map(t => t.year))];
    return years.sort((a, b) => b - a);
  }, [transactions]);

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

  return {
    // Data
    transactions: filteredTransactions,
    allTransactions: transactions,
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
    addTransactions,
    clearTransactions,

    // Validation state
    isValidating,
    validationResults,
    qualityMetrics,
  };
}
