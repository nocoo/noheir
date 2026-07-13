// Spec: docs/002-recurring-expense-calendar.md § Data Model + API Surface
//
// Persistence boundary for recurring spending rules. The `status` and
// `endedAt` fields are accepted on `update` here at the repository layer
// — the contract guard (silently drop unless the X-Internal-Action
// header is present) lives in the HTTP endpoint layer (P1-C6).
//
// `findAll` joins `expense_categories` so the list view can paint
// category name + colour in one round-trip; deletion of a category is
// modelled by D1's `ON DELETE SET NULL`, which we explicitly cover in
// tests because the foreign-key behaviour has historically varied
// between local libsql and remote D1.

import { and, asc, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { expenseCategories, recurringExpenses } from "../schema";
import type { NewRecurringExpense, RecurringExpense, RecurringExpenseWithCategory } from "../types";

/** Fields the spec allows on create. `endedAt` and `status` are excluded
 *  — they are only ever set by the end-state-machine action via the
 *  internal X-Internal-Action header path. */
export type RecurringExpenseCreateInput = Omit<
  NewRecurringExpense,
  "id" | "userId" | "createdAt" | "updatedAt" | "endedAt" | "status"
>;

/** Update payload: include `status` and `endedAt` so the state-machine
 *  actions can flip them. The HTTP layer is what gates whether a given
 *  caller is permitted to send these fields. */
export type RecurringExpenseUpdateInput = Partial<
  Omit<NewRecurringExpense, "id" | "userId" | "createdAt">
>;

export type CreateRecurringExpenseResult =
  | { ok: true; rule: RecurringExpense }
  | { ok: false; reason: "category_not_found" };

export type UpdateRecurringExpenseResult =
  | { ok: true; rule: RecurringExpense }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "category_not_found" };

async function categoryBelongsToUser(
  db: DrizzleD1Database,
  userId: string,
  categoryId: string,
): Promise<boolean> {
  const row = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(and(eq(expenseCategories.id, categoryId), eq(expenseCategories.userId, userId)))
    .get();
  return row !== undefined;
}

export function createRecurringExpensesRepo(db: DrizzleD1Database) {
  return {
    async findAll(userId: string): Promise<RecurringExpenseWithCategory[]> {
      const rows = await db
        .select({
          rule: recurringExpenses,
          categoryName: expenseCategories.name,
          colorToken: expenseCategories.colorToken,
        })
        .from(recurringExpenses)
        .leftJoin(
          expenseCategories,
          // Defensive: only join categories owned by the same user. Normal
          // write paths reject cross-user categoryId, but a stale FK or
          // direct SQL could leak another user's category metadata
          // through the joined name/colorToken. Constrain the join.
          and(
            eq(recurringExpenses.categoryId, expenseCategories.id),
            eq(expenseCategories.userId, userId),
          ),
        )
        .where(eq(recurringExpenses.userId, userId))
        .orderBy(asc(recurringExpenses.name), desc(recurringExpenses.createdAt))
        .all();

      return rows.map((row) => ({
        ...row.rule,
        categoryName: row.categoryName,
        colorToken: row.colorToken,
      }));
    },

    async findById(userId: string, id: string): Promise<RecurringExpense | null> {
      const row = await db
        .select()
        .from(recurringExpenses)
        .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
        .get();
      return row ?? null;
    },

    async create(
      userId: string,
      data: RecurringExpenseCreateInput,
    ): Promise<CreateRecurringExpenseResult> {
      // Cross-user category isolation: reject up-front instead of letting
      // the FK constraint allow it (the rule's FK only checks existence,
      // not ownership).
      if (data.categoryId) {
        const ok = await categoryBelongsToUser(db, userId, data.categoryId);
        if (!ok) {
          return { ok: false, reason: "category_not_found" };
        }
      }

      const rule = await db
        .insert(recurringExpenses)
        .values({ ...data, userId })
        .returning()
        .get();
      return { ok: true, rule };
    },

    async update(
      userId: string,
      id: string,
      data: RecurringExpenseUpdateInput,
    ): Promise<UpdateRecurringExpenseResult> {
      if (data.categoryId) {
        const ok = await categoryBelongsToUser(db, userId, data.categoryId);
        if (!ok) {
          return { ok: false, reason: "category_not_found" };
        }
      }

      const patch: Partial<NewRecurringExpense> = {
        ...data,
        updatedAt: new Date(),
      };
      const rows = await db
        .update(recurringExpenses)
        .set(patch)
        .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
        .returning();
      const rule = rows[0];
      if (!rule) {
        return { ok: false, reason: "not_found" };
      }
      return { ok: true, rule };
    },

    async delete(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(recurringExpenses)
        .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
        .returning({ id: recurringExpenses.id });
      return rows.length > 0;
    },
  };
}

export type RecurringExpensesRepo = ReturnType<typeof createRecurringExpensesRepo>;
