import { eq, and } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { financialProducts } from "../schema";
import type { FinancialProduct, NewFinancialProduct } from "../types";

export function createProductsRepo(db: DrizzleD1Database) {
  return {
    async findAll(userId: string, filters?: {
      channel?: string;
      category?: string;
      currency?: string;
    }): Promise<FinancialProduct[]> {
      let query = db
        .select()
        .from(financialProducts)
        .where(eq(financialProducts.userId, userId))
        .$dynamic();

      if (filters?.channel) {
        query = query.where(and(eq(financialProducts.userId, userId), eq(financialProducts.channel, filters.channel)));
      }
      if (filters?.category) {
        query = query.where(and(eq(financialProducts.userId, userId), eq(financialProducts.category, filters.category)));
      }
      if (filters?.currency) {
        query = query.where(and(eq(financialProducts.userId, userId), eq(financialProducts.currency, filters.currency)));
      }

      return await query.all();
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
