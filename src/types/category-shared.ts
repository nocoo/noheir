/**
 * Shared types for category hierarchy analysis
 * Used by both IncomeAnalysis and ExpenseAnalysis components
 */

export interface CategoryTransaction {
  date: string;
  amount: number;
}

export interface TertiaryCategory {
  name: string;
  total: number;
  percentage: number;
  transactions?: CategoryTransaction[];
}

export interface SecondaryCategory {
  name: string;
  total: number;
  percentage: number;
  parent: string;
  tertiaryList: TertiaryCategory[];
}

export interface PrimaryCategory {
  primary: string;
  total: number;
  percentage: number;
  secondaryCategories: SecondaryCategory[];
}

export interface CategoryData {
  chartData: PrimaryCategory[];
  outerPieData: Array<{ name: string; total: number; percentage: number; parent: string }>;
  detailList: PrimaryCategory[];
}

export interface AccountData {
  name: string;
  value: number;
  percentage: number;
}
