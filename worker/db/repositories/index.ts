import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createUsersRepo } from "./users";
import { createTransactionsRepo } from "./transactions";
import { createTransfersRepo } from "./transfers";
import { createProductsRepo } from "./products";
import { createUnitsRepo } from "./units";
import { createSettingsRepo } from "./settings";
import { createMetadataRepo } from "./metadata";
import { createReportsRepo } from "./reports";
import { createContributionLogsRepo } from "./contribution-logs";
import { createExpenseCategoriesRepo } from "./expense-categories";
import { createRecurringExpensesRepo } from "./recurring-expenses";

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

// Re-export individual repo factories and types
export { createUsersRepo, type UsersRepo } from "./users";
export { createTransactionsRepo, type TransactionsRepo } from "./transactions";
export { createTransfersRepo, type TransfersRepo } from "./transfers";
export { createProductsRepo, type ProductsRepo } from "./products";
export { createUnitsRepo, type UnitsRepo, type UnitWithAvailability } from "./units";
export { createSettingsRepo, type SettingsRepo } from "./settings";
export { createMetadataRepo, type MetadataRepo } from "./metadata";
export { createReportsRepo, type ReportsRepo } from "./reports";
export { createContributionLogsRepo, type ContributionLogsRepo } from "./contribution-logs";
export {
  createExpenseCategoriesRepo,
  type ExpenseCategoriesRepo,
  type ExpenseCategoryCreateInput,
  type ExpenseCategoryUpdateInput,
  type CreateExpenseCategoryResult,
  type UpdateExpenseCategoryResult,
} from "./expense-categories";
export {
  createRecurringExpensesRepo,
  type RecurringExpensesRepo,
  type RecurringExpenseCreateInput,
  type RecurringExpenseUpdateInput,
  type CreateRecurringExpenseResult,
  type UpdateRecurringExpenseResult,
} from "./recurring-expenses";

// Re-export search param and result types
export type { TransactionSearchParams, TransactionWithMatch, TransactionSearchResult } from "./transactions";
export type { TransferSearchParams, TransferWithMatch, TransferSearchResult } from "./transfers";
export type { ContributionLogsSearchParams, ContributionLogsSearchResult } from "./contribution-logs";
