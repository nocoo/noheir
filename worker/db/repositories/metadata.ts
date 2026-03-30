import { eq, sql, and, ne, isNotNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { transactions, transfers } from "../schema";
import type { FinancialMetadata } from "../types";

/**
 * Metadata repository matching the behavioral contract of
 * get_financial_metadata RPC.
 *
 * 9 fields aggregated from transactions + transfers tables:
 * years, accounts, categories, secondary_categories, tertiary_categories,
 * currencies, tags, transaction_count, transfer_count.
 */
export function createMetadataRepo(db: DrizzleD1Database) {
  return {
    async getAll(userId: string): Promise<FinancialMetadata> {
      // Run all queries in parallel for better performance
      const [
        txYears,
        trYears,
        txAccounts,
        trAccounts,
        categories,
        secondaryCategories,
        tertiaryCategories,
        txCurrencies,
        trCurrencies,
        txTags,
        trTags,
        txCount,
        trCount,
      ] = await Promise.all([
        // years: DISTINCT year from transactions
        db.selectDistinct({ value: transactions.year })
          .from(transactions)
          .where(eq(transactions.userId, userId))
          .all(),
        // years: DISTINCT year from transfers
        db.selectDistinct({ value: transfers.year })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .all(),
        // accounts: DISTINCT account from transactions
        db.selectDistinct({ value: transactions.account })
          .from(transactions)
          .where(eq(transactions.userId, userId))
          .all(),
        // accounts: DISTINCT account from transfers
        db.selectDistinct({ value: transfers.account })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .all(),
        // categories: DISTINCT primary_category from transactions
        db.selectDistinct({ value: transactions.primaryCategory })
          .from(transactions)
          .where(eq(transactions.userId, userId))
          .all(),
        // secondary_categories: DISTINCT, excluding null and ''
        db.selectDistinct({ value: transactions.secondaryCategory })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              isNotNull(transactions.secondaryCategory),
              ne(transactions.secondaryCategory, ""),
            ),
          )
          .all(),
        // tertiary_categories: DISTINCT, excluding null and ''
        db.selectDistinct({ value: transactions.tertiaryCategory })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              ne(transactions.tertiaryCategory, ""),
            ),
          )
          .all(),
        // currencies: DISTINCT from transactions
        db.selectDistinct({ value: transactions.currency })
          .from(transactions)
          .where(eq(transactions.userId, userId))
          .all(),
        // currencies: DISTINCT from transfers
        db.selectDistinct({ value: transfers.currency })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .all(),
        // tags: all from transactions (will parse + dedupe in JS)
        db.select({ value: transactions.tags })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              isNotNull(transactions.tags),
              ne(transactions.tags, "[]"),
            ),
          )
          .all(),
        // tags: all from transfers
        db.select({ value: transfers.tags })
          .from(transfers)
          .where(
            and(
              eq(transfers.userId, userId),
              isNotNull(transfers.tags),
              ne(transfers.tags, "[]"),
            ),
          )
          .all(),
        // transaction_count
        db.select({ count: sql<number>`count(*)` })
          .from(transactions)
          .where(eq(transactions.userId, userId))
          .get(),
        // transfer_count
        db.select({ count: sql<number>`count(*)` })
          .from(transfers)
          .where(eq(transfers.userId, userId))
          .get(),
      ]);

      // UNION logic: merge + dedupe arrays in JS
      const years = [...new Set([
        ...txYears.map((r) => r.value),
        ...trYears.map((r) => r.value),
      ])].sort((a, b) => b - a); // DESC

      const accounts = [...new Set([
        ...txAccounts.map((r) => r.value),
        ...trAccounts.map((r) => r.value),
      ])].sort();

      const currencies = [...new Set([
        ...txCurrencies.map((r) => r.value),
        ...trCurrencies.map((r) => r.value),
      ])].sort();

      // Parse JSON tags, collect unique, sort
      const tagSet = new Set<string>();
      for (const row of [...txTags, ...trTags]) {
        if (!row.value) continue;
        try {
          const parsed: unknown = JSON.parse(row.value);
          if (Array.isArray(parsed)) {
            for (const tag of parsed) {
              if (typeof tag === "string" && tag !== "") {
                tagSet.add(tag);
              }
            }
          }
        } catch {
          // skip malformed JSON
        }
      }

      return {
        years,
        accounts,
        categories: categories.map((r) => r.value).sort(),
        secondary_categories: secondaryCategories
          .map((r) => r.value)
          .filter((v): v is string => v !== null)
          .sort(),
        tertiary_categories: tertiaryCategories
          .map((r) => r.value)
          .sort(),
        currencies,
        tags: [...tagSet].sort(),
        transaction_count: txCount?.count ?? 0,
        transfer_count: trCount?.count ?? 0,
      };
    },
  };
}

export type MetadataRepo = ReturnType<typeof createMetadataRepo>;
