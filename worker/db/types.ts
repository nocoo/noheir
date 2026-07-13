/**
 * Inferred types from Drizzle schema for use across Worker and tests.
 */
import type {
  capitalUnits,
  contributionLogs,
  expenseCategories,
  financialProducts,
  mcpAuthSessions,
  mcpClients,
  mcpRefreshTokens,
  mcpTokens,
  recurringExpenses,
  settings,
  transactions,
  transfers,
  users,
} from "./schema";

// ── Select types (rows read from DB) ──

export type User = typeof users.$inferSelect;
export type FinancialProduct = typeof financialProducts.$inferSelect;
export type CapitalUnit = typeof capitalUnits.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type ContributionLog = typeof contributionLogs.$inferSelect;

// ── Insert types (rows to write) ──

export type NewUser = typeof users.$inferInsert;
export type NewFinancialProduct = typeof financialProducts.$inferInsert;
export type NewCapitalUnit = typeof capitalUnits.$inferInsert;
export type NewTransaction = typeof transactions.$inferInsert;
export type NewTransfer = typeof transfers.$inferInsert;
export type NewSetting = typeof settings.$inferInsert;
export type NewContributionLog = typeof contributionLogs.$inferInsert;

// ── Composite types ──

export interface UnitWithProduct extends CapitalUnit {
  product: FinancialProduct | null;
}

// ── Contribution log composite types ──

export interface ContributionLogWithRelations extends ContributionLog {
  unit: CapitalUnit | null;
  product: FinancialProduct | null;
}

export interface ContributionSummary {
  totalInvested: number;
  totalWithdrawn: number;
  netAmount: number;
  logCount: number;
  unitCount?: number; // Only for product summary
}

// ── Metadata response shape (must match get_financial_metadata RPC) ──

export interface FinancialMetadata {
  years: number[];
  accounts: string[];
  categories: string[];
  secondary_categories: string[];
  tertiary_categories: string[];
  currencies: string[];
  tags: string[];
  transaction_count: number;
  transfer_count: number;
}

// ── Monthly report response shape ──

export interface MonthlyReport {
  total_income: number;
  total_expense: number;
  net_amount: number;
  transaction_count: number;
  transfer_count: number;
  total_transfer_in: number;
  total_transfer_out: number;
  expense_by_category: CategoryBreakdown[];
  income_by_category: CategoryBreakdown[];
  currencies: string[];
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
}

// ── Yearly summary response shape ──

export interface YearlySummaryMonth {
  month: number;
  income: number;
  expense: number;
  count: number;
}

export interface YearlySummary {
  months: YearlySummaryMonth[];
  totals: {
    income: number;
    expense: number;
    count: number;
  };
}

// ── Category summary response shape ──

export interface CategorySummaryRow {
  primary_category: string;
  secondary_category: string | null;
  tertiary_category: string;
  total: number;
  count: number;
}

export interface CategorySummaryResponse {
  categories: CategorySummaryRow[];
}

// ── Account summary response shape ──

export interface AccountSummaryRow {
  account: string;
  type: string;
  total: number;
  count: number;
}

export interface AccountSummaryResponse {
  accounts: AccountSummaryRow[];
}

// ── Flow summary response shape ──

export interface FlowAccountCategoryRow {
  type: string;
  account: string;
  primary_category: string;
  total: number;
}

export interface FlowCategoryRow {
  type: string;
  primary_category: string;
  secondary_category: string | null;
  total: number;
}

export interface FlowSummaryResponse {
  account_to_category: FlowAccountCategoryRow[];
  category_to_subcategory: FlowCategoryRow[];
}

// ── MCP OAuth types ──

export type McpClient = typeof mcpClients.$inferSelect;
export type NewMcpClient = typeof mcpClients.$inferInsert;
export type McpAuthSession = typeof mcpAuthSessions.$inferSelect;
export type NewMcpAuthSession = typeof mcpAuthSessions.$inferInsert;
export type McpToken = typeof mcpTokens.$inferSelect;
export type NewMcpToken = typeof mcpTokens.$inferInsert;
export type McpRefreshToken = typeof mcpRefreshTokens.$inferSelect;
export type NewMcpRefreshToken = typeof mcpRefreshTokens.$inferInsert;

// ── Recurring expense calendar (002-recurring-expense-calendar.md) ──

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type NewExpenseCategory = typeof expenseCategories.$inferInsert;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type NewRecurringExpense = typeof recurringExpenses.$inferInsert;

/** List-level row for /api/recurring-expenses GET: rule columns joined
 *  with the rule's category (null when categoryId is null or category
 *  was deleted, leaving the FK as SET NULL). */
export interface RecurringExpenseWithCategory extends RecurringExpense {
  categoryName: string | null;
  colorToken: string | null;
}
