import { eq, and, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { financialProducts } from "../schema";
import type { FinancialProduct, NewFinancialProduct } from "../types";

export function createProductsRepo(db: DrizzleD1Database) {
  return {
    async findAll(userId: string, filters?: {
      channel?: string | undefined;
      category?: string | undefined;
      currency?: string | undefined;
      includeArchived?: boolean | undefined;
    }): Promise<FinancialProduct[]> {
      // Build conditions array
      const conditions: SQL[] = [eq(financialProducts.userId, userId)];

      if (filters?.channel) {
        conditions.push(eq(financialProducts.channel, filters.channel));
      }
      if (filters?.category) {
        conditions.push(eq(financialProducts.category, filters.category));
      }
      if (filters?.currency) {
        conditions.push(eq(financialProducts.currency, filters.currency));
      }
      // By default, exclude archived products
      if (!filters?.includeArchived) {
        conditions.push(eq(financialProducts.isArchived, false));
      }

      return await db
        .select()
        .from(financialProducts)
        .where(and(...conditions))
        .all();
    },

    async findById(userId: string, id: string): Promise<FinancialProduct | null> {
      const row = await db
        .select()
        .from(financialProducts)
        .where(and(eq(financialProducts.id, id), eq(financialProducts.userId, userId)))
        .get();
      return row ?? null;
    },

    async create(userId: string, data: Omit<NewFinancialProduct, "id" | "userId" | "createdAt">): Promise<FinancialProduct> {
      return await db
        .insert(financialProducts)
        .values({ ...data, userId })
        .returning()
        .get();
    },

    async update(userId: string, id: string, data: Partial<Omit<NewFinancialProduct, "id" | "userId" | "createdAt">>): Promise<FinancialProduct | null> {
      const rows = await db
        .update(financialProducts)
        .set(data)
        .where(and(eq(financialProducts.id, id), eq(financialProducts.userId, userId)))
        .returning()
        .all();
      return rows[0] ?? null;
    },

    async delete(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(financialProducts)
        .where(and(eq(financialProducts.id, id), eq(financialProducts.userId, userId)))
        .returning()
        .all();
      return rows.length > 0;
    },
  };
}

export type ProductsRepo = ReturnType<typeof createProductsRepo>;
