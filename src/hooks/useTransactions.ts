import { useState, useMemo } from 'react';
import { Transaction, CategorySummary, MonthlyData, YearlyComparison } from '@/types/transaction';

// Sample data for demonstration
const sampleTransactions: Transaction[] = [
  { id: '1', date: '2024-01-15', year: 2024, month: 1, primaryCategory: '餐饮', secondaryCategory: '外卖', amount: 85, account: '微信', type: 'expense' },
  { id: '2', date: '2024-01-20', year: 2024, month: 1, primaryCategory: '交通', secondaryCategory: '地铁', amount: 50, account: '支付宝', type: 'expense' },
  { id: '3', date: '2024-02-05', year: 2024, month: 2, primaryCategory: '收入', secondaryCategory: '工资', amount: 15000, account: '银行卡', type: 'income' },
  { id: '4', date: '2024-02-10', year: 2024, month: 2, primaryCategory: '购物', secondaryCategory: '服装', amount: 500, account: '信用卡', type: 'expense' },
  { id: '5', date: '2024-03-01', year: 2024, month: 3, primaryCategory: '住房', secondaryCategory: '房租', amount: 3500, account: '银行卡', type: 'expense' },
  { id: '6', date: '2024-03-15', year: 2024, month: 3, primaryCategory: '收入', secondaryCategory: '工资', amount: 15000, account: '银行卡', type: 'income' },
  { id: '7', date: '2024-04-01', year: 2024, month: 4, primaryCategory: '餐饮', secondaryCategory: '超市', amount: 320, account: '微信', type: 'expense' },
  { id: '8', date: '2024-04-15', year: 2024, month: 4, primaryCategory: '娱乐', secondaryCategory: '电影', amount: 120, account: '支付宝', type: 'expense' },
  { id: '9', date: '2023-01-10', year: 2023, month: 1, primaryCategory: '餐饮', secondaryCategory: '外卖', amount: 75, account: '微信', type: 'expense' },
  { id: '10', date: '2023-02-05', year: 2023, month: 2, primaryCategory: '收入', secondaryCategory: '工资', amount: 12000, account: '银行卡', type: 'income' },
  { id: '11', date: '2023-03-01', year: 2023, month: 3, primaryCategory: '住房', secondaryCategory: '房租', amount: 3000, account: '银行卡', type: 'expense' },
  { id: '12', date: '2023-04-15', year: 2023, month: 4, primaryCategory: '交通', secondaryCategory: '打车', amount: 200, account: '支付宝', type: 'expense' },
];

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(sampleTransactions);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [comparisonYears, setComparisonYears] = useState<number[]>([2023, 2024]);

  const availableYears = useMemo(() => {
    const years = [...new Set(transactions.map(t => t.year))];
    return years.sort((a, b) => b - a);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.year === selectedYear);
  }, [transactions, selectedYear]);

  const monthlyData: MonthlyData[] = useMemo(() => {
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    return months.map((month, index) => {
      const monthTransactions = filteredTransactions.filter(t => t.month === index + 1);
      const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return { month, income, expense, balance: income - expense };
    });
  }, [filteredTransactions]);

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

  const totalIncome = useMemo(() => 
    filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const totalExpense = useMemo(() => 
    filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const addTransactions = (newTransactions: Transaction[]) => {
    setTransactions(prev => [...prev, ...newTransactions]);
  };

  const clearTransactions = () => {
    setTransactions([]);
  };

  return {
    transactions: filteredTransactions,
    allTransactions: transactions,
    monthlyData,
    categoryData,
    yearlyComparison,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    selectedYear,
    setSelectedYear,
    comparisonYears,
    setComparisonYears,
    availableYears,
    addTransactions,
    clearTransactions,
  };
}
