import type { ActionResult } from "@/lib/action-result";
import {
  recurringExpenseInputSchema,
  recurringExpenseUpdateSchema,
} from "@/lib/recurring-expense/rule-types";
import {
  type RecurringExpenseCreatePayload,
  type RecurringExpenseUpdatePayload,
  WorkerDbError,
  workerDbClient,
} from "@/lib/worker-db-client";

function actionError(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof WorkerDbError) {
    return { success: false, error: err.message };
  }
  if (err instanceof Error) {
    return { success: false, error: err.message };
  }
  return { success: false, error: fallback };
}

function toCreatePayload(
  data: { amount: number } & Omit<RecurringExpenseCreatePayload, "amountCents">,
): RecurringExpenseCreatePayload {
  const { amount, ...rest } = data;
  return {
    ...rest,
    amountCents: Math.round(amount * 100),
  };
}

export async function createRecurringExpense(data: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = recurringExpenseInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  try {
    const payload = toCreatePayload(parsed.data);
    const result = await workerDbClient.createRecurringExpense(payload);
    return { success: true, data: { id: result.rule.id } };
  } catch (err) {
    return actionError(err, "Failed to create recurring expense");
  }
}

export async function updateRecurringExpense(id: string, data: unknown): Promise<ActionResult> {
  const parsed = recurringExpenseUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const { amount, ...rest } = parsed.data;
  const payload: RecurringExpenseUpdatePayload = { ...rest };
  if (amount != null) {
    (payload as { amountCents?: number }).amountCents = Math.round(amount * 100);
  }
  try {
    await workerDbClient.updateRecurringExpense(id, payload);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to update recurring expense");
  }
}

export async function deleteRecurringExpense(id: string): Promise<ActionResult> {
  try {
    await workerDbClient.deleteRecurringExpense(id);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to delete recurring expense");
  }
}
