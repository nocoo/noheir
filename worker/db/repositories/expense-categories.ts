// Spec: docs/002-recurring-expense-calendar.md § Data Model + API Surface
//
// All operations scoped by userId. The (userId, name) uniqueness is
// enforced by `expense_categories_user_name_uniq`; we surface duplicates
// as a typed result so the HTTP layer can return 409 without sniffing
// SQLite error strings.

import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { expenseCategories } from "../schema";
import type {
  ExpenseCategory,
  NewExpenseCategory,
} from "../types";

export type ExpenseCategoryCreateInput = Omit<
  NewExpenseCategory,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export type ExpenseCategoryUpdateInput = Partial<
  Pick<NewExpenseCategory, "name" | "colorToken" | "sortOrder">
>;

export type CreateExpenseCategoryResult =
  | { ok: true; category: ExpenseCategory }
  | { ok: false; reason: "duplicate_name" };

export type UpdateExpenseCategoryResult =
  | { ok: true; category: ExpenseCategory }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "duplicate_name" };

function isUniqueConstraintError(err: unknown): boolean {
  // D1 wraps the original sqlite error twice: top-level message is
  // "D1_ERROR: UNIQUE constraint failed: ..." with a `cause` Error
  // carrying just "UNIQUE constraint failed: ...". better-sqlite3 (test
  // path) raises a single Error with the inner message. Walk the chain
  // so either runtime is handled.
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (current instanceof Error) {
      const msg = current.message;
      if (
        msg.includes("UNIQUE constraint failed: expense_categories.user_id") ||
        msg.includes("expense_categories_user_name_uniq")
      ) {
        return true;
      }
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}

export function createExpenseCategoriesRepo(db: DrizzleD1Database) {
  return {
    async findAll(userId: string): Promise<ExpenseCategory[]> {
      return db
        .select()
        .from(expenseCategories)
        .where(eq(expenseCategories.userId, userId))
        .orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name))
        .all();
    },

    async findById(userId: string, id: string): Promise<ExpenseCategory | null> {
      const row = await db
        .select()
        .from(expenseCategories)
        .where(
          and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)),
        )
        .get();
      return row ?? null;
    },

    async create(
      userId: string,
      data: ExpenseCategoryCreateInput,
    ): Promise<CreateExpenseCategoryResult> {
      try {
        const category = await db
          .insert(expenseCategories)
          .values({ ...data, userId })
          .returning()
          .get();
        return { ok: true, category };
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return { ok: false, reason: "duplicate_name" };
        }
        throw err;
      }
    },

    async update(
      userId: string,
      id: string,
      data: ExpenseCategoryUpdateInput,
    ): Promise<UpdateExpenseCategoryResult> {
      // Bump updatedAt on every change so the UI can show "last edited"
      // without making the caller pass it explicitly.
      const patch: Partial<NewExpenseCategory> = { ...data, updatedAt: new Date() };
      try {
        const rows = await db
          .update(expenseCategories)
          .set(patch)
          .where(
            and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)),
          )
          .returning();
        const category = rows[0];
        if (!category) {
          return { ok: false, reason: "not_found" };
        }
        return { ok: true, category };
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return { ok: false, reason: "duplicate_name" };
        }
        throw err;
      }
    },

    /** Returns true on hit, false when no row matched (so the route layer
     *  can produce a 404 without a separate findById round-trip). */
    async delete(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(expenseCategories)
        .where(
          and(eq(expenseCategories.id, id), eq(expenseCategories.userId, userId)),
        )
        .returning({ id: expenseCategories.id });
      return rows.length > 0;
    },
  };
}

export type ExpenseCategoriesRepo = ReturnType<typeof createExpenseCategoriesRepo>;
