import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createContributionLogsRepo } from "./contribution-logs";
import { createExpenseCategoriesRepo } from "./expense-categories";
import { createMetadataRepo } from "./metadata";
import { createProductsRepo } from "./products";
import { createRecurringExpensesRepo } from "./recurring-expenses";
import { createReportsRepo } from "./reports";
import { createSettingsRepo } from "./settings";
import { createTransactionsRepo } from "./transactions";
import { createTransfersRepo } from "./transfers";
import { createUnitsRepo } from "./units";
import { createUsersRepo } from "./users";

export function createAllRepos(db: DrizzleD1Database) {
  return {
    users: createUsersRepo(db),
    transactions: createTransactionsRepo(db),
    transfers: createTransfersRepo(db),
    products: createProductsRepo(db),
    units: createUnitsRepo(db),
    settings: createSettingsRepo(db),
    metadata: createMetadataRepo(db),
    reports: createReportsRepo(db),
    contributionLogs: createContributionLogsRepo(db),
    expenseCategories: createExpenseCategoriesRepo(db),
    recurringExpenses: createRecurringExpensesRepo(db),
  };
}

export type AllRepos = ReturnType<typeof createAllRepos>;

export type {
  ContributionLogsSearchParams,
  ContributionLogsSearchResult,
} from "./contribution-logs";
export { type ContributionLogsRepo, createContributionLogsRepo } from "./contribution-logs";
export {
  type CreateExpenseCategoryResult,
  createExpenseCategoriesRepo,
  type ExpenseCategoriesRepo,
  type ExpenseCategoryCreateInput,
  type ExpenseCategoryUpdateInput,
  type UpdateExpenseCategoryResult,
} from "./expense-categories";
export { createMetadataRepo, type MetadataRepo } from "./metadata";
export { createProductsRepo, type ProductsRepo } from "./products";
export {
  type CreateRecurringExpenseResult,
  createRecurringExpensesRepo,
  type RecurringExpenseCreateInput,
  type RecurringExpensesRepo,
  type RecurringExpenseUpdateInput,
  type UpdateRecurringExpenseResult,
} from "./recurring-expenses";
export { createReportsRepo, type ReportsRepo } from "./reports";
export { createSettingsRepo, type SettingsRepo } from "./settings";
// Re-export search param and result types
export type {
  TransactionSearchParams,
  TransactionSearchResult,
  TransactionWithMatch,
} from "./transactions";
export { createTransactionsRepo, type TransactionsRepo } from "./transactions";
export type { TransferSearchParams, TransferSearchResult, TransferWithMatch } from "./transfers";
export { createTransfersRepo, type TransfersRepo } from "./transfers";
export { createUnitsRepo, type UnitsRepo, type UnitWithAvailability } from "./units";
// Re-export individual repo factories and types
export { createUsersRepo, type UsersRepo } from "./users";
