/**
 * Domain types for Gen 2.
 *
 * These mirror Gen 1 types but use the canonical field names from the
 * Drizzle schema. The domain layer works with display-ready values
 * (amounts as floats, not cents) — the conversion happens at the
 * data loading boundary (server actions / WorkerDbClient).
 */

// ── Transaction types ──

export interface DomainTransaction {
  id: string;
  date: string;
  year: number;
  month: number;
  primaryCategory: string;
  secondaryCategory: string | null;
  tertiaryCategory: string;
  amount: number; // Display value (cents / 100)
  account: string;
  type: "income" | "expense";
  currency: string;
  tags: string[];
  note: string | null;
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

export interface CategorySummary {
  category: string;
  total: number;
  percentage: number;
  subcategories: Array<{ name: string; total: number }>;
}

// ── Transfer types ──

export interface DomainTransfer {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  primaryCategory: string | null;
  secondaryCategory: string | null;
  transactionType: string | null;
  inflowAmount: number; // Display value (cents / 100)
  outflowAmount: number;
  currency: string;
  account: string;
  tags: string[];
  note: string | null;
}

// ── Asset types ──

export type Currency = "CNY" | "USD" | "HKD";

export type InvestmentStrategy =
  | "远期理财" | "美元资产" | "36存单"
  | "长期理财" | "短期理财" | "中期理财"
  | "进攻计划" | "麻麻理财";

export type InvestmentTactics =
  | "养老年金" | "个人养老金" | "定期存款"
  | "理财产品" | "现金产品" | "债券基金"
  | "偏股基金" | "稳健理财" | "增额寿险"
  | "货币基金";

export type UnitStatus = "已成立" | "计划中" | "筹集中" | "已归档";

export interface DomainProduct {
  id: string;
  name: string;
  code: string | null;
  channel: string | null;
  category: string | null;
  currency: string | null;
  lockPeriodDays: number | null;
  annualReturnRate: number | null;
  isArchived: boolean;
}

export interface DomainUnit {
  id: string;
  unitCode: string;
  amount: number; // Display value (cents / 100)
  currency: Currency;
  status: UnitStatus;
  strategy: InvestmentStrategy;
  tactics: InvestmentTactics;
  productId: string | null;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
  product?: DomainProduct | null;
}

export interface UnitDisplayInfo extends DomainUnit {
  /** Computed: latestInvest.operationDate + product.lockPeriodDays */
  availableDate: string | null;
  /** Whether the unit is available (today >= availableDate) */
  isAvailable: boolean;
  /** Days until available (positive = locked, 0 or negative = available since N days) */
  daysUntilAvailable: number | null;
  /** Most recent invest log operationDate */
  latestInvestDate: string | null;
}

// ── Contribution Log types ──

export type ContributionOperationType = "invest" | "withdraw" | "adjust";
export type ContributionSource = "manual" | "auto" | "import";

export interface DomainContributionLog {
  id: string;
  unitId: string;
  productId: string | null;
  productName: string | null;
  operationType: ContributionOperationType;
  amount: number; // Display value (cents / 100), positive = invest, negative = withdraw
  balanceAfter: number | null;
  operationDate: string;
  source: ContributionSource;
  note: string | null;
  unit: DomainUnit | null;
  product: DomainProduct | null;
  isDeleted: boolean;
  createdAt: Date;
}

export interface ContributionSummary {
  totalInvested: number; // cents
  totalWithdrawn: number; // cents
  netAmount: number; // cents
  logCount: number;
  unitCount?: number; // only for product summary
}

// ── Insight types ──

export interface RecurringPayment {
  id: string;
  description: string;
  account: string;
  amount: number;
  frequency: "monthly" | "quarterly" | "yearly" | "weekly" | "biweekly";
  nextPaymentDate: string;
  averageInterval: number;
  occurrences: number;
  totalAmount: number;
  category: string;
  yearlyTotal: number;
  recentTransactions: Array<{
    date: string;
    amount: number;
    description: string;
  }>;
}

export interface PaymentInsight {
  type: "recurring_payment" | "upcoming_renewal" | "irregular_payment" | "budget_alert";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  amount?: number;
  dueDate?: string;
  recommendation: string;
  confidence: number;
}

// ── Settings types ──

export type AccountType = "debit" | "credit" | "prepaid" | "financial" | "unclassified";

export interface AccountTypeConfig {
  accountName: string;
  type: AccountType;
}

export interface BalanceAnchor {
  accountName: string;
  date: string;
  balance: number;
}

export interface AIConfig {
  enabled: boolean;
  apiKey: string;
  baseURL: string;
  modelName: string;
}

// ── Theme & Color types ──

export type Theme = "light" | "dark" | "system";
export type ColorScheme = "default" | "swapped";
