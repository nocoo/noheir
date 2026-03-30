import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { capitalUnits, financialProducts } from "../schema";
import type { CapitalUnit, NewCapitalUnit, UnitWithProduct } from "../types";

export function createUnitsRepo(db: DrizzleD1Database) {
  return {
    async findAll(userId: string, filters?: {
      status?: string;
      strategy?: string;
      tactics?: string;
      currency?: string;
    }): Promise<CapitalUnit[]> {
      let query = db
        .select()
        .from(capitalUnits)
        .where(eq(capitalUnits.userId, userId))
        .$dynamic();

      if (filters?.status) {
        query = query.where(and(eq(capitalUnits.userId, userId), eq(capitalUnits.status, filters.status)));
      }
      if (filters?.strategy) {
        query = query.where(and(eq(capitalUnits.userId, userId), eq(capitalUnits.strategy, filters.strategy)));
      }
      if (filters?.tactics) {
        query = query.where(and(eq(capitalUnits.userId, userId), eq(capitalUnits.tactics, filters.tactics)));
      }
      if (filters?.currency) {
        query = query.where(and(eq(capitalUnits.userId, userId), eq(capitalUnits.currency, filters.currency)));
      }

      return await query.all();
    },

    /** LEFT JOIN with financial_products — behavioral contract from get_units_with_products RPC */
    async findAllWithProducts(userId: string): Promise<UnitWithProduct[]> {
      const rows = await db
        .select({
          unit: capitalUnits,
          product: financialProducts,
        })
        .from(capitalUnits)
        .leftJoin(financialProducts, eq(capitalUnits.productId, financialProducts.id))
        .where(eq(capitalUnits.userId, userId))
        .orderBy(capitalUnits.createdAt)
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

    async create(userId: string, data: Omit<NewCapitalUnit, "id" | "userId" | "createdAt">): Promise<CapitalUnit> {
      return await db
        .insert(capitalUnits)
        .values({ ...data, userId })
        .returning()
        .get();
    },

    async update(userId: string, id: string, data: Partial<Omit<NewCapitalUnit, "id" | "userId" | "createdAt">>): Promise<CapitalUnit | null> {
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
  };
}

export type UnitsRepo = ReturnType<typeof createUnitsRepo>;
