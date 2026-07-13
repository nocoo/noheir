"use server";

// Server Actions for expense categories.
// Spec: docs/002-recurring-expense-calendar.md § Server Actions
//
// All writes return ActionResult<T> so the UI can display errors via
// the project's standard sonner toast pattern. Zod validation lives
// next to the schemas in src/lib/recurring-expense/rule-types.ts so
// the action stays a thin adapter.

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { getAuthedClient } from "@/lib/api-helpers";
import { categoryInputSchema } from "@/lib/recurring-expense/rule-types";
import { WorkerDbError } from "@/lib/worker-db-client";

const PLAN_PATH = "/plan";

function actionError(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof WorkerDbError) {
    if (err.statusCode === 409) {
      return { success: false, error: "分类名已存在" };
    }
    return { success: false, error: err.message };
  }
  if (err instanceof Error) {
    return { success: false, error: err.message };
  }
  return { success: false, error: fallback };
}

export async function createExpenseCategory(data: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = categoryInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  try {
    const { userId, client } = await getAuthedClient();
    const result = await client.createExpenseCategory(userId, parsed.data);
    revalidatePath(PLAN_PATH);
    return { success: true, data: { id: result.category.id } };
  } catch (err) {
    return actionError(err, "Failed to create category");
  }
}

export async function updateExpenseCategory(id: string, data: unknown): Promise<ActionResult> {
  const parsed = categoryInputSchema.partial().safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  try {
    const { userId, client } = await getAuthedClient();
    await client.updateExpenseCategory(userId, id, parsed.data);
    revalidatePath(PLAN_PATH);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to update category");
  }
}

export async function deleteExpenseCategory(id: string): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient();
    await client.deleteExpenseCategory(userId, id);
    revalidatePath(PLAN_PATH);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to delete category");
  }
}
