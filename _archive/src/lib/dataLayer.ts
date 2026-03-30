import {
  ParsedTransaction,
  TransactionValidation,
  CleanedTransaction,
  DataQualityMetrics,
  AggregatedByCategory,
  AggregatedByAccount,
  AggregatedByMonth,
  AggregatedBySubcategory
} from '@/types/data';
import {
  validateTransaction,
  calculateQualityMetrics,
  cleanTransactions
} from './dataValidator';

/**
 * Data layer manager for handling data transformation pipeline
 */
export class DataLayerManager {
  private rawTransactions: ParsedTransaction[] = [];
  private validations: TransactionValidation[] = [];
  private cleanedTransactions: CleanedTransaction[] = [];
  private qualityMetrics: DataQualityMetrics | null = null;

  /**
   * Load raw transactions
   */
  loadRaw(transactions: ParsedTransaction[]): void {
    this.rawTransactions = transactions;
    this.validations = [];
    this.cleanedTransactions = [];
    this.qualityMetrics = null;
  }

  /**
   * Get raw transactions
   */
  getRaw(): ParsedTransaction[] {
    return this.rawTransactions;
  }

  /**
   * Validate all raw transactions
   */
  validate(): TransactionValidation[] {
    this.validations = this.rawTransactions.map(t => validateTransaction(t));
    this.qualityMetrics = calculateQualityMetrics(this.validations);
    return this.validations;
  }

  /**
   * Get validations
   */
  getValidations(): TransactionValidation[] {
    return this.validations;
  }

  /**
   * Get quality metrics
   */
  getMetrics(): DataQualityMetrics | null {
    return this.qualityMetrics;
  }

  /**
   * Clean transactions based on validation results
   */
  clean(options: {
    includeCritical?: boolean;
    includeErrors?: boolean;
    includeWarnings?: boolean;
  } = {}): CleanedTransaction[] {
    if (this.validations.length === 0) {
      this.validate();
    }

    this.cleanedTransactions = cleanTransactions(this.validations, options);
    return this.cleanedTransactions;
  }

  /**
   * Get cleaned transactions
   */
  getCleaned(): CleanedTransaction[] {
    return this.cleanedTransactions;
  }

  /**
   * Aggregate by category
   */
  aggregateByCategory(transactions?: CleanedTransaction[]): AggregatedByCategory[] {
    const data = transactions || this.cleanedTransactions;

    if (data.length === 0) return [];

    const expenseData = data.filter(t => t.type === 'expense');
    const totalExpense = expenseData.reduce((sum, t) => sum + t.amount, 0);

    const categoryMap = new Map<string, {
      total: number;
      count: number;
      subcategories: Map<string, { total: number; count: number }>;
    }>();

    expenseData.forEach(t => {
      if (!categoryMap.has(t.primaryCategory)) {
        categoryMap.set(t.primaryCategory, {
          total: 0,
          count: 0,
          subcategories: new Map()
        });
      }

      const cat = categoryMap.get(t.primaryCategory)!;
      cat.total += t.amount;
      cat.count += 1;

      if (!cat.subcategories.has(t.secondaryCategory)) {
        cat.subcategories.set(t.secondaryCategory, { total: 0, count: 0 });
      }

      const sub = cat.subcategories.get(t.secondaryCategory)!;
      sub.total += t.amount;
      sub.count += 1;
    });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        totalAmount: data.total,
        count: data.count,
        averageAmount: data.count > 0 ? data.total / data.count : 0,
        percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0,
        subcategories: Array.from(data.subcategories.entries())
          .map(([subcategory, sub]) => ({
            subcategory,
            totalAmount: sub.total,
            count: sub.count,
            averageAmount: sub.count > 0 ? sub.total / sub.count : 0,
            percentage: data.total > 0 ? (sub.total / data.total) * 100 : 0
          }))
          .sort((a, b) => b.totalAmount - a.totalAmount)
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }

  /**
   * Aggregate by account
   */
  aggregateByAccount(transactions?: CleanedTransaction[]): AggregatedByAccount[] {
    const data = transactions || this.cleanedTransactions;

    if (data.length === 0) return [];

    const accountMap = new Map<string, {
      income: number;
      expense: number;
      count: number;
    }>();

    data.forEach(t => {
      if (!accountMap.has(t.account)) {
        accountMap.set(t.account, { income: 0, expense: 0, count: 0 });
      }

      const acc = accountMap.get(t.account)!;
      acc.count += 1;

      if (t.type === 'income') {
        acc.income += t.amount;
      } else {
        acc.expense += t.amount;
      }
    });

    return Array.from(accountMap.entries())
      .map(([account, data]) => ({
        account,
        income: data.income,
        expense: data.expense,
        balance: data.income - data.expense,
        count: data.count
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }

  /**
   * Aggregate by month
   */
  aggregateByMonth(transactions?: CleanedTransaction[]): AggregatedByMonth[] {
    const data = transactions || this.cleanedTransactions;

    if (data.length === 0) return [];

    const monthMap = new Map<string, {
      year: number;
      month: number;
      income: number;
      expense: number;
      count: number;
    }>();

    data.forEach(t => {
      const key = `${t.year}-${t.month.toString().padStart(2, '0')}`;

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          year: t.year,
          month: t.month,
          income: 0,
          expense: 0,
          count: 0
        });
      }

      const m = monthMap.get(key)!;
      m.count += 1;

      if (t.type === 'income') {
        m.income += t.amount;
      } else {
        m.expense += t.amount;
      }
    });

    const monthLabels = [
      '一月', '二月', '三月', '四月', '五月', '六月',
      '七月', '八月', '九月', '十月', '十一月', '十二月'
    ];

    return Array.from(monthMap.values())
      .map(m => ({
        year: m.year,
        month: m.month,
        monthLabel: `${m.year}年${monthLabels[m.month - 1]}`,
        income: m.income,
        expense: m.expense,
        balance: m.income - m.expense,
        count: m.count
      }))
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
  }

  /**
   * Get transactions by date range
   */
  getByDateRange(
    startDate: string,
    endDate: string,
    transactions?: CleanedTransaction[]
  ): CleanedTransaction[] {
    const data = transactions || this.cleanedTransactions;

    return data.filter(t => t.date >= startDate && t.date <= endDate);
  }

  /**
   * Get transactions by category
   */
  getByCategory(
    category: string,
    transactions?: CleanedTransaction[]
  ): CleanedTransaction[] {
    const data = transactions || this.cleanedTransactions;

    return data.filter(t => t.primaryCategory === category);
  }

  /**
   * Get transactions by account
   */
  getByAccount(
    account: string,
    transactions?: CleanedTransaction[]
  ): CleanedTransaction[] {
    const data = transactions || this.cleanedTransactions;

    return data.filter(t => t.account === account);
  }

  /**
   * Get transactions by type
   */
  getByType(
    type: 'income' | 'expense',
    transactions?: CleanedTransaction[]
  ): CleanedTransaction[] {
    const data = transactions || this.cleanedTransactions;

    return data.filter(t => t.type === type);
  }

  /**
   * Search transactions by note
   */
  searchByNote(
    keyword: string,
    transactions?: CleanedTransaction[]
  ): CleanedTransaction[] {
    const data = transactions || this.cleanedTransactions;

    if (!keyword) return data;

    const lowerKeyword = keyword.toLowerCase();
    return data.filter(t =>
      t.note?.toLowerCase().includes(lowerKeyword) ||
      t.secondaryCategory.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Get summary statistics
   */
  getSummary(transactions?: CleanedTransaction[]) {
    const data = transactions || this.cleanedTransactions;

    if (data.length === 0) {
      return {
        totalTransactions: 0,
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        averageIncome: 0,
        averageExpense: 0,
        incomeCount: 0,
        expenseCount: 0
      };
    }

    const incomeData = data.filter(t => t.type === 'income');
    const expenseData = data.filter(t => t.type === 'expense');

    const totalIncome = incomeData.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expenseData.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalTransactions: data.length,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      averageIncome: incomeData.length > 0 ? totalIncome / incomeData.length : 0,
      averageExpense: expenseData.length > 0 ? totalExpense / expenseData.length : 0,
      incomeCount: incomeData.length,
      expenseCount: expenseData.length
    };
  }

  /**
   * Reset all data
   */
  reset(): void {
    this.rawTransactions = [];
    this.validations = [];
    this.cleanedTransactions = [];
    this.qualityMetrics = null;
  }
}

/**
 * Create a new data layer manager instance
 */
export function createDataLayerManager(): DataLayerManager {
  return new DataLayerManager();
}
