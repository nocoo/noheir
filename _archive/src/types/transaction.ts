export interface Transaction {
  id: string;
  date: string;
  year: number;
  month: number;
  primaryCategory: string;   // 一级分类
  secondaryCategory: string; // 二级分类
  tertiaryCategory: string;  // 三级分类
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
