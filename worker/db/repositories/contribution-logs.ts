import { eq, and, gte, lte, isNull, isNotNull, desc, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { contributionLogs, capitalUnits, financialProducts } from "../schema";
import type {
  ContributionLog,
  NewContributionLog,
  ContributionLogWithRelations,
  ContributionSummary,
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
  logs: ContributionLogWithRelations[];
  total: number;
}

export function createContributionLogsRepo(db: DrizzleD1Database) {
  return {
    /**
     * Get the latest invest log for each unit in the given list.
     * Returns a Map from unitId to the latest invest ContributionLog.
     */
    async getLatestInvestLogs(
      userId: string,
      unitIds: string[]
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
        const rows = await db
          .select()
          .from(contributionLogs)
          .where(
            and(
              eq(contributionLogs.userId, userId),
              inArray(contributionLogs.unitId, batch),
              eq(contributionLogs.operationType, "invest"),
              isNull(contributionLogs.deletedAt)
            )
          )
          .orderBy(desc(contributionLogs.operationDate), desc(contributionLogs.createdAt))
          .all();

        // Group by unitId, take the first (latest) for each
        for (const row of rows) {
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
        .where(and(
          eq(contributionLogs.id, id),
          eq(contributionLogs.userId, userId),
        ))
        .get();
      return row ?? null;
    },

    async search(userId: string, params: ContributionLogsSearchParams = {}): Promise<ContributionLogsSearchResult> {
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
      if (params.startDate) {
        conditions.push(gte(contributionLogs.operationDate, params.startDate));
      }
      if (params.endDate) {
        conditions.push(lte(contributionLogs.operationDate, params.endDate));
      }

      const limit = params.limit ?? 100;
      const offset = params.offset ?? 0;

      const rows = await db
        .select({
          log: contributionLogs,
          unit: capitalUnits,
          product: financialProducts,
        })
        .from(contributionLogs)
        .leftJoin(capitalUnits, eq(contributionLogs.unitId, capitalUnits.id))
        .leftJoin(financialProducts, eq(contributionLogs.productId, financialProducts.id))
        .where(and(...conditions))
        .orderBy(desc(contributionLogs.operationDate), desc(contributionLogs.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

      // For now, total = returned count. Could add COUNT(*) query for pagination.
      const total = rows.length;

      return {
        logs: rows.map((row) => ({
          ...row.log,
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
        .where(and(
          eq(contributionLogs.userId, userId),
          eq(contributionLogs.unitId, unitId),
          isNull(contributionLogs.deletedAt),
        ))
        .all();

      let totalInvested = 0;
      let totalWithdrawn = 0;

      for (const row of rows) {
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
        logCount: rows.length,
      };
    },

    async summarizeByProduct(userId: string, productId: string): Promise<ContributionSummary> {
      const rows = await db
        .select()
        .from(contributionLogs)
        .where(and(
          eq(contributionLogs.userId, userId),
          eq(contributionLogs.productId, productId),
          isNull(contributionLogs.deletedAt),
        ))
        .all();

      let totalInvested = 0;
      let totalWithdrawn = 0;
      const unitIds = new Set<string>();

      for (const row of rows) {
        unitIds.add(row.unitId);
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
      data: Partial<Pick<ContributionLog, "operationType" | "amountCents" | "balanceAfterCents" | "operationDate" | "note">>,
    ): Promise<ContributionLog | null> {
      const rows = await db
        .update(contributionLogs)
        .set({ ...data, updatedAt: new Date() })
        .where(and(
          eq(contributionLogs.id, id),
          eq(contributionLogs.userId, userId),
          isNull(contributionLogs.deletedAt),
        ))
        .returning()
        .all();
      return rows[0] ?? null;
    },

    async softDelete(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .update(contributionLogs)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(contributionLogs.id, id),
          eq(contributionLogs.userId, userId),
          isNull(contributionLogs.deletedAt),
        ))
        .returning()
        .all();
      return rows.length > 0;
    },

    async restore(userId: string, id: string): Promise<ContributionLog | null> {
      const rows = await db
        .update(contributionLogs)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(and(
          eq(contributionLogs.id, id),
          eq(contributionLogs.userId, userId),
          isNotNull(contributionLogs.deletedAt),
        ))
        .returning()
        .all();
      return rows[0] ?? null;
    },
  };
}

export type ContributionLogsRepo = ReturnType<typeof createContributionLogsRepo>;
