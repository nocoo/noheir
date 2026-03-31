import { eq, and, gte, lte, sql, like, or, desc, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { transactions } from "../schema";
import type { Transaction, NewTransaction } from "../types";

export interface TransactionSearchParams {
  keyword?: string;
  categories?: string[];
  secondary_categories?: string[];
  tertiary_categories?: string[];
  type?: string;
  accounts?: string[];
  tags?: string[];
  start_date?: string;
  end_date?: string;
  min_amount_cents?: number;
  max_amount_cents?: number;
  limit?: number;
  offset?: number;
  year?: number;
  month?: number;
  currency?: string;
}

export interface TransactionWithMatch extends Transaction {
  matched_field: string | null;
}

export interface TransactionSearchResult {
  transactions: TransactionWithMatch[];
  total_returned: number;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return 100;
  return Math.min(Math.max(limit, 1), 10_000);
}

/**
 * Determine which field the keyword matched against.
 * Priority order matches the original RPC: note → primary_category →
 * secondary_category → tertiary_category → account.
 */
function computeMatchedField(
  row: Transaction,
  keyword: string | undefined,
): string | null {
  if (!keyword) return null;
  const kw = keyword.toLowerCase();
  if (row.note && row.note.toLowerCase().includes(kw)) return "note";
  if (row.primaryCategory.toLowerCase().includes(kw)) return "category";
  if (row.secondaryCategory && row.secondaryCategory.toLowerCase().includes(kw))
    return "secondary_category";
  if (row.tertiaryCategory.toLowerCase().includes(kw))
    return "tertiary_category";
  if (row.account.toLowerCase().includes(kw)) return "account";
  return null;
}

/**
 * Check if a row's JSON tags overlap with the filter tags.
 * Tags are stored as '["tag1","tag2"]' JSON strings.
 */
function tagsOverlap(rowTags: string | null, filterTags: string[]): boolean {
  if (!rowTags) return false;
  try {
    const parsed: unknown = JSON.parse(rowTags);
    if (!Array.isArray(parsed)) return false;
    return (parsed as string[]).some((t) => filterTags.includes(t));
  } catch {
    return false;
  }
}

export function createTransactionsRepo(db: DrizzleD1Database) {
  return {
    /**
     * Full-featured search matching the behavioral contract of
     * search_transactions_fuzzy RPC.
     *
     * All 16 params are optional; all combine with AND logic.
     * Keyword searches across 5 fields (note, primary_category,
     * secondary_category, tertiary_category, account) using LIKE.
     * Returns matched_field indicating which field matched.
     */
    async search(
      userId: string,
      params: TransactionSearchParams = {},
    ): Promise<TransactionSearchResult> {
      const conditions = [eq(transactions.userId, userId)];

      // Keyword: OR across 5 fields
      if (params.keyword) {
        const pattern = `%${params.keyword}%`;
        conditions.push(
          or(
            like(transactions.note, pattern),
            like(transactions.primaryCategory, pattern),
            like(transactions.secondaryCategory, pattern),
            like(transactions.tertiaryCategory, pattern),
            like(transactions.account, pattern),
          )!,
        );
      }

      // Category filters (IN)
      if (params.categories && params.categories.length > 0) {
        conditions.push(inArray(transactions.primaryCategory, params.categories));
      }
      if (params.secondary_categories && params.secondary_categories.length > 0) {
        conditions.push(
          inArray(transactions.secondaryCategory, params.secondary_categories),
        );
      }
      if (params.tertiary_categories && params.tertiary_categories.length > 0) {
        conditions.push(
          inArray(transactions.tertiaryCategory, params.tertiary_categories),
        );
      }

      // Type filter
      if (params.type) {
        conditions.push(eq(transactions.type, params.type));
      }

      // Accounts filter (IN)
      if (params.accounts && params.accounts.length > 0) {
        conditions.push(inArray(transactions.account, params.accounts));
      }

      // Date range
      if (params.start_date) {
        conditions.push(gte(transactions.date, params.start_date));
      }
      if (params.end_date) {
        conditions.push(lte(transactions.date, params.end_date));
      }

      // Amount range (cents)
      if (params.min_amount_cents !== undefined) {
        conditions.push(gte(transactions.amountCents, params.min_amount_cents));
      }
      if (params.max_amount_cents !== undefined) {
        conditions.push(lte(transactions.amountCents, params.max_amount_cents));
      }

      // Year / month
      if (params.year !== undefined) {
        conditions.push(eq(transactions.year, params.year));
      }
      if (params.month !== undefined) {
        conditions.push(eq(transactions.month, params.month));
      }

      // Currency
      if (params.currency) {
        conditions.push(eq(transactions.currency, params.currency));
      }

      const limit = clampLimit(params.limit);
      const offset = params.offset ?? 0;

      const rows = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      // Post-filter: tags overlap (cannot be expressed in a single WHERE clause
      // with JSON-stored arrays) and compute matched_field
      let filtered = rows;
      if (params.tags && params.tags.length > 0) {
        filtered = rows.filter((row) => tagsOverlap(row.tags, params.tags!));
      }

      const result: TransactionWithMatch[] = filtered.map((row) => ({
        ...row,
        matched_field: computeMatchedField(row, params.keyword),
      }));

      return {
        transactions: result,
        total_returned: result.length,
      };
    },

    async findById(
      userId: string,
      id: string,
    ): Promise<Transaction | null> {
      const row = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
        .get();
      return row ?? null;
    },

    async create(
      userId: string,
      data: Omit<NewTransaction, "id" | "userId" | "createdAt">,
    ): Promise<Transaction> {
      return await db
        .insert(transactions)
        .values({ ...data, userId })
        .returning()
        .get();
    },

    async createMany(
      userId: string,
      rows: Omit<NewTransaction, "id" | "userId" | "createdAt">[],
    ): Promise<number> {
      if (rows.length === 0) return 0;
      // D1 limit: 100 bound parameters per query. transactions has 18 columns,
      // so max 5 rows per INSERT (5 × 18 = 90 < 100).
      const BATCH_SIZE = 5;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const result = await db
          .insert(transactions)
          .values(chunk.map((r) => ({ ...r, userId })))
          .returning()
          .all();
        inserted += result.length;
      }
      return inserted;
    },

    async update(
      userId: string,
      id: string,
      data: Partial<
        Omit<NewTransaction, "id" | "userId" | "createdAt">
      >,
    ): Promise<Transaction | null> {
      const rows = await db
        .update(transactions)
        .set(data)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
        .returning()
        .all();
      return rows[0] ?? null;
    },

    async delete(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
        .returning()
        .all();
      return rows.length > 0;
    },

    async deleteByUser(userId: string): Promise<number> {
      const rows = await db
        .delete(transactions)
        .where(eq(transactions.userId, userId))
        .returning()
        .all();
      return rows.length;
    },

    async count(userId: string): Promise<number> {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .get();
      return result?.count ?? 0;
    },

    async countByYear(userId: string, year: number): Promise<number> {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.year, year)))
        .get();
      return result?.count ?? 0;
    },

    async deleteByYear(userId: string, year: number): Promise<number> {
      const rows = await db
        .delete(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.year, year)))
        .returning()
        .all();
      return rows.length;
    },
  };
}

export type TransactionsRepo = ReturnType<typeof createTransactionsRepo>;
