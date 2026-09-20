import type { ActionResult } from "@/lib/action-result";
import { categoryInputSchema } from "@/lib/recurring-expense/rule-types";
import { WorkerDbError, workerDbClient } from "@/lib/worker-db-client";

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
    const result = await workerDbClient.createExpenseCategory(parsed.data);
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
    await workerDbClient.updateExpenseCategory(id, parsed.data);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to update category");
  }
}

export async function deleteExpenseCategory(id: string): Promise<ActionResult> {
  try {
    await workerDbClient.deleteExpenseCategory(id);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to delete category");
  }
}
