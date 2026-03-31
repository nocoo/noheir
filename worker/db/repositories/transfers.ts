import { eq, and, gte, lte, sql, like, or, desc, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { transfers } from "../schema";
import type { Transfer, NewTransfer } from "../types";

export interface TransferSearchParams {
  keyword?: string;
  accounts?: string[];
  transaction_type?: string;
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

export interface TransferWithMatch extends Transfer {
  matched_field: string | null;
}

export interface TransferSearchResult {
  transfers: TransferWithMatch[];
  total_returned: number;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return 100;
  return Math.min(Math.max(limit, 1), 500);
}

/**
 * Determine which field the keyword matched against.
 * Behavioral contract: secondary_category match returns 'category'
 * (matches original RPC that only returns 3 distinct values:
 * 'note', 'category', 'account').
 */
function computeMatchedField(
  row: Transfer,
  keyword: string | undefined,
): string | null {
  if (!keyword) return null;
  const kw = keyword.toLowerCase();
  if (row.note && row.note.toLowerCase().includes(kw)) return "note";
  if (row.primaryCategory && row.primaryCategory.toLowerCase().includes(kw))
    return "category";
  if (
    row.secondaryCategory &&
    row.secondaryCategory.toLowerCase().includes(kw)
  )
    return "category";
  if (row.account.toLowerCase().includes(kw)) return "account";
  return null;
}

/**
 * Check if a row's JSON tags overlap with the filter tags.
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

export function createTransfersRepo(db: DrizzleD1Database) {
  return {
    /**
     * Full-featured search matching the behavioral contract of
     * search_transfers_fuzzy RPC.
     *
     * All 13 params are optional; all combine with AND logic.
     * Amount filter uses MAX(inflow, outflow) to match GREATEST() behavior.
     */
    async search(
      userId: string,
      params: TransferSearchParams = {},
    ): Promise<TransferSearchResult> {
      const conditions = [eq(transfers.userId, userId)];

      // Keyword: OR across 4 fields
      if (params.keyword) {
        const pattern = `%${params.keyword}%`;
        conditions.push(
          or(
            like(transfers.note, pattern),
            like(transfers.primaryCategory, pattern),
            like(transfers.secondaryCategory, pattern),
            like(transfers.account, pattern),
          )!,
        );
      }

      // Accounts filter (IN)
      if (params.accounts && params.accounts.length > 0) {
        conditions.push(inArray(transfers.account, params.accounts));
      }

      // Transaction type
      if (params.transaction_type) {
        conditions.push(
          eq(transfers.transactionType, params.transaction_type),
        );
      }

      // Date range
      if (params.start_date) {
        conditions.push(gte(transfers.date, params.start_date));
      }
      if (params.end_date) {
        conditions.push(lte(transfers.date, params.end_date));
      }

      // Amount range: uses MAX(inflow, outflow) to match GREATEST() behavior
      if (params.min_amount_cents !== undefined) {
        conditions.push(
          sql`MAX(${transfers.inflowAmountCents}, ${transfers.outflowAmountCents}) >= ${params.min_amount_cents}`,
        );
      }
      if (params.max_amount_cents !== undefined) {
        conditions.push(
          sql`MAX(${transfers.inflowAmountCents}, ${transfers.outflowAmountCents}) <= ${params.max_amount_cents}`,
        );
      }

      // Year / month
      if (params.year !== undefined) {
        conditions.push(eq(transfers.year, params.year));
      }
      if (params.month !== undefined) {
        conditions.push(eq(transfers.month, params.month));
      }

      // Currency
      if (params.currency) {
        conditions.push(eq(transfers.currency, params.currency));
      }

      const limit = clampLimit(params.limit);
      const offset = params.offset ?? 0;

      const rows = await db
        .select()
        .from(transfers)
        .where(and(...conditions))
        .orderBy(desc(transfers.date), desc(transfers.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      // Post-filter: tags overlap
      let filtered = rows;
      if (params.tags && params.tags.length > 0) {
        filtered = rows.filter((row) => tagsOverlap(row.tags, params.tags!));
      }

      const result: TransferWithMatch[] = filtered.map((row) => ({
        ...row,
        matched_field: computeMatchedField(row, params.keyword),
      }));

      return {
        transfers: result,
        total_returned: result.length,
      };
    },

    async findById(userId: string, id: string): Promise<Transfer | null> {
      const row = await db
        .select()
        .from(transfers)
        .where(and(eq(transfers.id, id), eq(transfers.userId, userId)))
        .get();
      return row ?? null;
    },

    async create(
      userId: string,
      data: Omit<NewTransfer, "id" | "userId" | "createdAt">,
    ): Promise<Transfer> {
      return await db
        .insert(transfers)
        .values({ ...data, userId })
        .returning()
        .get();
    },

    async createMany(
      userId: string,
      rows: Omit<NewTransfer, "id" | "userId" | "createdAt">[],
    ): Promise<number> {
      if (rows.length === 0) return 0;
      const BATCH_SIZE = 10;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        const result = await db
          .insert(transfers)
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
      data: Partial<Omit<NewTransfer, "id" | "userId" | "createdAt">>,
    ): Promise<Transfer | null> {
      const rows = await db
        .update(transfers)
        .set(data)
        .where(and(eq(transfers.id, id), eq(transfers.userId, userId)))
        .returning()
        .all();
      return rows[0] ?? null;
    },

    async delete(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(transfers)
        .where(and(eq(transfers.id, id), eq(transfers.userId, userId)))
        .returning()
        .all();
      return rows.length > 0;
    },

    async deleteByUser(userId: string): Promise<number> {
      const rows = await db
        .delete(transfers)
        .where(eq(transfers.userId, userId))
        .returning()
        .all();
      return rows.length;
    },

    async count(userId: string): Promise<number> {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(transfers)
        .where(eq(transfers.userId, userId))
        .get();
      return result?.count ?? 0;
    },

    async countByYear(userId: string, year: number): Promise<number> {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(transfers)
        .where(and(eq(transfers.userId, userId), eq(transfers.year, year)))
        .get();
      return result?.count ?? 0;
    },

    async deleteByYear(userId: string, year: number): Promise<number> {
      const rows = await db
        .delete(transfers)
        .where(and(eq(transfers.userId, userId), eq(transfers.year, year)))
        .returning()
        .all();
      return rows.length;
    },
  };
}

export type TransfersRepo = ReturnType<typeof createTransfersRepo>;
