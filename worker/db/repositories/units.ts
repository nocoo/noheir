import { and, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { type AvailabilityInfo, computeAvailability } from "../../lib/availability";
import { capitalUnits, financialProducts } from "../schema";
import type { CapitalUnit, ContributionLog, NewCapitalUnit, UnitWithProduct } from "../types";

export interface UnitWithAvailability extends UnitWithProduct, AvailabilityInfo {}

export function createUnitsRepo(db: DrizzleD1Database) {
  return {
    /**
     * Enrich units with availability info using latest invest logs.
     * Called from API layer after fetching latest invest logs from contribution logs repo.
     */
    enrichWithAvailability(
      units: UnitWithProduct[],
      latestInvestLogs: Map<string, ContributionLog>,
    ): UnitWithAvailability[] {
      return units.map((unit) => {
        const latestInvest = latestInvestLogs.get(unit.id) ?? null;
        const availability = computeAvailability(
          latestInvest ? { operationDate: latestInvest.operationDate } : null,
          unit.product
            ? {
                lockPeriodDays: unit.product.lockPeriodDays,
                openDays: unit.product.openDays,
                cycleDays: unit.product.cycleDays,
              }
            : null,
        );
        return {
          ...unit,
          ...availability,
        };
      });
    },

    async findAll(
      userId: string,
      filters?: {
        status?: string;
        strategy?: string;
        tactics?: string;
        currency?: string;
      },
    ): Promise<CapitalUnit[]> {
      // Build all conditions upfront, then apply with and()
      const conditions = [eq(capitalUnits.userId, userId)];

      if (filters?.status) {
        conditions.push(eq(capitalUnits.status, filters.status));
      }
      if (filters?.strategy) {
        conditions.push(eq(capitalUnits.strategy, filters.strategy));
      }
      if (filters?.tactics) {
        conditions.push(eq(capitalUnits.tactics, filters.tactics));
      }
      if (filters?.currency) {
        conditions.push(eq(capitalUnits.currency, filters.currency));
      }

      return await db
        .select()
        .from(capitalUnits)
        .where(and(...conditions))
        .orderBy(desc(capitalUnits.createdAt))
        .all();
    },

    /** LEFT JOIN with financial_products — behavioral contract from get_units_with_products RPC */
    async findAllWithProducts(
      userId: string,
      filters?: {
        status?: string;
        strategy?: string;
        tactics?: string;
        currency?: string;
      },
    ): Promise<UnitWithProduct[]> {
      // Build all conditions upfront
      const conditions = [eq(capitalUnits.userId, userId)];

      if (filters?.status) {
        conditions.push(eq(capitalUnits.status, filters.status));
      }
      if (filters?.strategy) {
        conditions.push(eq(capitalUnits.strategy, filters.strategy));
      }
      if (filters?.tactics) {
        conditions.push(eq(capitalUnits.tactics, filters.tactics));
      }
      if (filters?.currency) {
        conditions.push(eq(capitalUnits.currency, filters.currency));
      }

      const rows = await db
        .select({
          unit: capitalUnits,
          product: financialProducts,
        })
        .from(capitalUnits)
        .leftJoin(financialProducts, eq(capitalUnits.productId, financialProducts.id))
        .where(and(...conditions))
        .orderBy(desc(capitalUnits.createdAt))
        .all();

      return rows.map((row) => ({
        ...row.unit,
        product: row.product,
      }));
    },

    async findById(userId: string, id: string): Promise<CapitalUnit | null> {
      const row = await db
        .select()
        .from(capitalUnits)
        .where(and(eq(capitalUnits.id, id), eq(capitalUnits.userId, userId)))
        .get();
      return row ?? null;
    },

    async findByIdWithProduct(userId: string, id: string): Promise<UnitWithProduct | null> {
      const row = await db
        .select({
          unit: capitalUnits,
          product: financialProducts,
        })
        .from(capitalUnits)
        .leftJoin(financialProducts, eq(capitalUnits.productId, financialProducts.id))
        .where(and(eq(capitalUnits.id, id), eq(capitalUnits.userId, userId)))
        .get();
      if (!row) return null;
      return {
        ...row.unit,
        product: row.product,
      };
    },

    async create(
      userId: string,
      data: Omit<NewCapitalUnit, "id" | "userId" | "createdAt">,
    ): Promise<CapitalUnit> {
      return await db
        .insert(capitalUnits)
        .values({ ...data, userId })
        .returning()
        .get();
    },

    async update(
      userId: string,
      id: string,
      data: Partial<Omit<NewCapitalUnit, "id" | "userId" | "createdAt">>,
    ): Promise<CapitalUnit | null> {
      const rows = await db
        .update(capitalUnits)
        .set(data)
        .where(and(eq(capitalUnits.id, id), eq(capitalUnits.userId, userId)))
        .returning()
        .all();
      return rows[0] ?? null;
    },

    async delete(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(capitalUnits)
        .where(and(eq(capitalUnits.id, id), eq(capitalUnits.userId, userId)))
        .returning()
        .all();
      return rows.length > 0;
    },

    /**
     * Unlink all units from a product (set productId to null).
     * Used when archiving/deleting a product.
     * Returns count of units unlinked.
     */
    async unlinkProduct(userId: string, productId: string): Promise<number> {
      const rows = await db
        .update(capitalUnits)
        .set({ productId: null })
        .where(and(eq(capitalUnits.userId, userId), eq(capitalUnits.productId, productId)))
        .returning()
        .all();
      return rows.length;
    },
  };
}

export type UnitsRepo = ReturnType<typeof createUnitsRepo>;
