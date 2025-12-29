export interface Transaction {
  id: string;
  date: string;
  year: number;
  month: number;
  primaryCategory: string;
  secondaryCategory: string;
  amount: number;
  account: string;
  description?: string;
  type: 'income' | 'expense';
}

export interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
  subcategories: { name: string; total: number }[];
}

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export interface YearlyComparison {
  year: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  categoryBreakdown: CategorySummary[];
}
