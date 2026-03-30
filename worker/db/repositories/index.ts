import type { DrizzleD1Database } from "drizzle-orm/d1";
import { createTransactionsRepo } from "./transactions";
import { createTransfersRepo } from "./transfers";
import { createProductsRepo } from "./products";
import { createUnitsRepo } from "./units";
import { createSettingsRepo } from "./settings";
import { createMetadataRepo } from "./metadata";
import { createReportsRepo } from "./reports";

export function createAllRepos(db: DrizzleD1Database) {
  return {
    transactions: createTransactionsRepo(db),
    transfers: createTransfersRepo(db),
    products: createProductsRepo(db),
    units: createUnitsRepo(db),
    settings: createSettingsRepo(db),
    metadata: createMetadataRepo(db),
    reports: createReportsRepo(db),
  };
}

export type AllRepos = ReturnType<typeof createAllRepos>;

// Re-export individual repo factories and types
export { createTransactionsRepo, type TransactionsRepo } from "./transactions";
export { createTransfersRepo, type TransfersRepo } from "./transfers";
export { createProductsRepo, type ProductsRepo } from "./products";
export { createUnitsRepo, type UnitsRepo } from "./units";
export { createSettingsRepo, type SettingsRepo } from "./settings";
export { createMetadataRepo, type MetadataRepo } from "./metadata";
export { createReportsRepo, type ReportsRepo } from "./reports";

// Re-export search param and result types
export type { TransactionSearchParams, TransactionWithMatch, TransactionSearchResult } from "./transactions";
export type { TransferSearchParams, TransferWithMatch, TransferSearchResult } from "./transfers";
