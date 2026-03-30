/**
 * Inferred types from Drizzle schema for use across Worker and tests.
 */
import type {
  users,
  financialProducts,
  capitalUnits,
  transactions,
  transfers,
  settings,
} from "./schema";

// ── Select types (rows read from DB) ──

export type User = typeof users.$inferSelect;
export type FinancialProduct = typeof financialProducts.$inferSelect;
export type CapitalUnit = typeof capitalUnits.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type Setting = typeof settings.$inferSelect;

// ── Insert types (rows to write) ──

export type NewUser = typeof users.$inferInsert;
export type NewFinancialProduct = typeof financialProducts.$inferInsert;
export type NewCapitalUnit = typeof capitalUnits.$inferInsert;
export type NewTransaction = typeof transactions.$inferInsert;
export type NewTransfer = typeof transfers.$inferInsert;
export type NewSetting = typeof settings.$inferInsert;

// ── Composite types ──

export interface UnitWithProduct extends CapitalUnit {
  product: FinancialProduct | null;
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
