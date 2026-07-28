import { and, desc, eq, getTableColumns, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  compareLogsForTimeline,
  normalizeLogTimestamp,
  sortLogsForTimeline,
} from "../../lib/contribution-log-time";
import { capitalUnits, contributionLogs, financialProducts } from "../schema";
import type {
  ContributionLog,
  ContributionLogWithRelations,
  ContributionSummary,
  NewContributionLog,
} from "../types";

export interface ContributionLogsSearchParams {
  unitId?: string | undefined;
  productId?: string | undefined;
  operationType?: string | undefined;
  source?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  includeDeleted?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ContributionLogsSearchResult {
  logs: Array<ContributionLogWithRelations & { createdAtMs: number | null }>;
  total: number;
}

/** A log row with its created_at normalized to epoch milliseconds. */
export type ContributionLogForTimeline = ContributionLog & { createdAtMs: number | null };

/** Cap for a single unit's timeline — see docs/003 § Risk 5. */
export const UNIT_TIMELINE_LIMIT = 500;

export function createContributionLogsRepo(db: DrizzleD1Database) {
  return {
    /**
     * Get the latest invest log for each unit in the given list.
     * Returns a Map from unitId to the latest invest ContributionLog.
     */
    async getLatestInvestLogs(
      userId: string,
      unitIds: string[],
    ): Promise<Map<string, ContributionLog>> {
      if (unitIds.length === 0) {
        return new Map();
      }

      // Batch queries to avoid D1 parameter limits
      // D1 seems to have issues with large IN clauses (> ~50 params)
      const BATCH_SIZE = 50;
      const result = new Map<string, ContributionLog>();

      for (let i = 0; i < unitIds.length; i += BATCH_SIZE) {
        const batch = unitIds.slice(i, i + BATCH_SIZE);
        // Project created_at raw: Drizzle's mode:"timestamp" codec would decode
        // the three production encodings (ms / s / ISO text) incorrectly.
        const rows = await db
          .select({
            ...getTableColumns(contributionLogs),
            rawCreatedAt: sql<number | string | null>`${contributionLogs.createdAt}`,
          })
          .from(contributionLogs)
          .where(
            and(
              eq(contributionLogs.userId, userId),
              inArray(contributionLogs.unitId, batch),
              eq(contributionLogs.operationType, "invest"),
              isNull(contributionLogs.deletedAt),
            ),
          )
          .orderBy(desc(contributionLogs.operationDate))
          .all();

        const sorted = [...rows].sort((a, b) =>
          compareLogsForTimeline(
            {
              operationDate: a.operationDate,
              createdAtMs: normalizeLogTimestamp(a.rawCreatedAt),
              id: a.id,
            },
            {
              operationDate: b.operationDate,
              createdAtMs: normalizeLogTimestamp(b.rawCreatedAt),
              id: b.id,
            },
          ),
        );

        // Group by unitId, take the first (latest) for each
        for (const { rawCreatedAt: _rawCreatedAt, ...row } of sorted) {
          if (!result.has(row.unitId)) {
            result.set(row.unitId, row);
          }
        }
      }

      return result;
    },

    async findById(userId: string, id: string): Promise<ContributionLog | null> {
      const row = await db
        .select()
        .from(contributionLogs)
        .where(and(eq(contributionLogs.id, id), eq(contributionLogs.userId, userId)))
        .get();
      return row ?? null;
    },

    /**
     * All logs for one unit, newest first, with created_at normalized.
     * Backs the unit dialog timeline (docs/003 § GET /api/units/:id/logs).
     */
    async listByUnit(
      userId: string,
      unitId: string,
      limit: number = UNIT_TIMELINE_LIMIT,
    ): Promise<ContributionLogForTimeline[]> {
      const rows = await db
        .select({
          ...getTableColumns(contributionLogs),
          rawCreatedAt: sql<number | string | null>`${contributionLogs.createdAt}`,
        })
        .from(contributionLogs)
        .where(
          and(
            eq(contributionLogs.userId, userId),
            eq(contributionLogs.unitId, unitId),
            isNull(contributionLogs.deletedAt),
          ),
        )
        .orderBy(sql`substr(${contributionLogs.operationDate}, 1, 10) DESC`)
        .limit(limit)
        .all();

      const mapped = rows.map(({ rawCreatedAt, ...row }) => ({
        ...row,
        createdAtMs: normalizeLogTimestamp(rawCreatedAt),
      }));

      return sortLogsForTimeline(mapped);
    },

    async search(
      userId: string,
      params: ContributionLogsSearchParams = {},
    ): Promise<ContributionLogsSearchResult> {
      const conditions = [eq(contributionLogs.userId, userId)];

      if (!params.includeDeleted) {
        conditions.push(isNull(contributionLogs.deletedAt));
      }
      if (params.unitId) {
        conditions.push(eq(contributionLogs.unitId, params.unitId));
      }
      if (params.productId) {
        conditions.push(eq(contributionLogs.productId, params.productId));
      }
      if (params.operationType) {
        conditions.push(eq(contributionLogs.operationType, params.operationType));
      }
      if (params.source) {
        conditions.push(eq(contributionLogs.source, params.source));
      }
      // substr() over the raw column so the 132 legacy ISO rows (docs/003 § B2c)
      // compare as plain dates instead of sorting after every same-day entry.
      if (params.startDate) {
        conditions.push(
          sql`substr(${contributionLogs.operationDate}, 1, 10) >= ${params.startDate}`,
        );
      }
      if (params.endDate) {
        conditions.push(sql`substr(${contributionLogs.operationDate}, 1, 10) <= ${params.endDate}`);
      }

      const limit = params.limit ?? 100;
      const offset = params.offset ?? 0;

      const rows = await db
        .select({
          log: contributionLogs,
          unit: capitalUnits,
          product: financialProducts,
          rawCreatedAt: sql<number | string | null>`${contributionLogs.createdAt}`,
        })
        .from(contributionLogs)
        .leftJoin(capitalUnits, eq(contributionLogs.unitId, capitalUnits.id))
        .leftJoin(financialProducts, eq(contributionLogs.productId, financialProducts.id))
        .where(and(...conditions))
        .orderBy(sql`substr(${contributionLogs.operationDate}, 1, 10) DESC`)
        .limit(limit)
        .offset(offset)
        .all();

      // Secondary sort in JS on normalized timestamps; SQL cannot compare the
      // three production created_at encodings. Runs after pagination — see
      // docs/003 § Risk 8 for the cross-page caveat.
      const sorted = [...rows].sort((a, b) =>
        compareLogsForTimeline(
          {
            operationDate: a.log.operationDate,
            createdAtMs: normalizeLogTimestamp(a.rawCreatedAt),
            id: a.log.id,
          },
          {
            operationDate: b.log.operationDate,
            createdAtMs: normalizeLogTimestamp(b.rawCreatedAt),
            id: b.log.id,
          },
        ),
      );

      // For now, total = returned count. Could add COUNT(*) query for pagination.
      const total = sorted.length;

      return {
        // createdAtMs travels with the row: the web mapper must not have to
        // re-parse the three raw encodings (docs/003 § B1).
        logs: sorted.map((row) => ({
          ...row.log,
          createdAtMs: normalizeLogTimestamp(row.rawCreatedAt),
          unit: row.unit,
          product: row.product,
        })),
        total,
      };
    },

    async summarizeByUnit(userId: string, unitId: string): Promise<ContributionSummary> {
      const rows = await db
        .select()
        .from(contributionLogs)
        .where(
          and(
            eq(contributionLogs.userId, userId),
            eq(contributionLogs.unitId, unitId),
            isNull(contributionLogs.deletedAt),
          ),
        )
        .all();

      let totalInvested = 0;
      let totalWithdrawn = 0;
      let totalPnl = 0;

      for (const row of rows) {
        totalPnl += row.pnlCents ?? 0;
        if (row.amountCents > 0) {
          totalInvested += row.amountCents;
        } else {
          totalWithdrawn += Math.abs(row.amountCents);
        }
      }

      return {
        totalInvested,
        totalWithdrawn,
        netAmount: totalInvested - totalWithdrawn,
        totalPnl,
        logCount: rows.length,
      };
    },

    async summarizeByProduct(userId: string, productId: string): Promise<ContributionSummary> {
      const rows = await db
        .select()
        .from(contributionLogs)
        .where(
          and(
            eq(contributionLogs.userId, userId),
            eq(contributionLogs.productId, productId),
            isNull(contributionLogs.deletedAt),
          ),
        )
        .all();

      let totalInvested = 0;
      let totalWithdrawn = 0;
      let totalPnl = 0;
      const unitIds = new Set<string>();

      for (const row of rows) {
        unitIds.add(row.unitId);
        totalPnl += row.pnlCents ?? 0;
        if (row.amountCents > 0) {
          totalInvested += row.amountCents;
        } else {
          totalWithdrawn += Math.abs(row.amountCents);
        }
      }

      return {
        totalInvested,
        totalWithdrawn,
        netAmount: totalInvested - totalWithdrawn,
        totalPnl,
        logCount: rows.length,
        unitCount: unitIds.size,
      };
    },

    async create(
      userId: string,
      data: Omit<NewContributionLog, "id" | "userId" | "createdAt" | "updatedAt">,
    ): Promise<ContributionLog> {
      const now = new Date();
      return await db
        .insert(contributionLogs)
        .values({ ...data, userId, createdAt: now, updatedAt: now })
        .returning()
        .get();
    },

    async update(
      userId: string,
      id: string,
      data: Partial<
        Pick<
          ContributionLog,
          | "operationType"
          | "amountCents"
          | "balanceAfterCents"
          | "pnlCents"
          | "operationDate"
          | "note"
        >
      >,
    ): Promise<ContributionLog | null> {
      const rows = await db
        .update(contributionLogs)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(contributionLogs.id, id),
            eq(contributionLogs.userId, userId),
            isNull(contributionLogs.deletedAt),
          ),
        )
        .returning()
        .all();
      return rows[0] ?? null;
    },

    async softDelete(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .update(contributionLogs)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(contributionLogs.id, id),
            eq(contributionLogs.userId, userId),
            isNull(contributionLogs.deletedAt),
          ),
        )
        .returning()
        .all();
      return rows.length > 0;
    },

    async restore(userId: string, id: string): Promise<ContributionLog | null> {
      const rows = await db
        .update(contributionLogs)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(contributionLogs.id, id),
            eq(contributionLogs.userId, userId),
            isNotNull(contributionLogs.deletedAt),
          ),
        )
        .returning()
        .all();
      return rows[0] ?? null;
    },
  };
}

export type ContributionLogsRepo = ReturnType<typeof createContributionLogsRepo>;
