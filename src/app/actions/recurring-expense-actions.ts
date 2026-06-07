"use server";

// CRUD Server Actions for recurring expense rules.
// Spec: docs/002-recurring-expense-calendar.md § Server Actions
//
// State-machine actions (pause / resume / end) live in P2-C9 — they
// need the X-Internal-Action channel; CRUD here never does. Zod
// validation strips `status` / `endedAt` from any user input so a
// regular update call cannot mutate the lifecycle fields even if the
// caller forgets the type narrowing.

import { revalidatePath } from "next/cache";
import { getAuthedClient } from "@/lib/api-helpers";
import type { ActionResult } from "@/lib/action-result";
import {
  recurringExpenseInputSchema,
  recurringExpenseUpdateSchema,
} from "@/lib/recurring-expense/rule-types";
import {
  WorkerDbError,
  type RecurringExpenseCreatePayload,
  type RecurringExpenseUpdatePayload,
} from "@/lib/worker-db-client";

const PLAN_PATH = "/plan";

function actionError(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof WorkerDbError) {
    return { success: false, error: err.message };
  }
  if (err instanceof Error) {
    return { success: false, error: err.message };
  }
  return { success: false, error: fallback };
}

/** Convert a Zod-validated input (yuan-denominated `amount`) into the
 *  Worker payload shape (`amountCents`). Defensive: status / endedAt
 *  are not in the Zod schema, but defense-in-depth never hurts. */
function toCreatePayload(
  data: { amount: number } & Omit<RecurringExpenseCreatePayload, "amountCents">,
): RecurringExpenseCreatePayload {
  const { amount, ...rest } = data;
  return {
    ...rest,
    amountCents: Math.round(amount * 100),
  };
}

export async function createRecurringExpense(
  data: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = recurringExpenseInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  try {
    const { userId, client } = await getAuthedClient();
    const payload = toCreatePayload(parsed.data);
    const result = await client.createRecurringExpense(userId, payload);
    revalidatePath(PLAN_PATH);
    return { success: true, data: { id: result.rule.id } };
  } catch (err) {
    return actionError(err, "Failed to create recurring expense");
  }
}

export async function updateRecurringExpense(
  id: string,
  data: unknown,
): Promise<ActionResult> {
  const parsed = recurringExpenseUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  // Build partial payload, mapping yuan→cents only when amount provided.
  const { amount, ...rest } = parsed.data;
  const payload: RecurringExpenseUpdatePayload = { ...rest };
  if (amount != null) {
    (payload as { amountCents?: number }).amountCents = Math.round(amount * 100);
  }
  try {
    const { userId, client } = await getAuthedClient();
    // No `internal: true` here — Worker silently drops status/endedAt.
    await client.updateRecurringExpense(userId, id, payload);
    revalidatePath(PLAN_PATH);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to update recurring expense");
  }
}

export async function deleteRecurringExpense(
  id: string,
): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient();
    await client.deleteRecurringExpense(userId, id);
    revalidatePath(PLAN_PATH);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to delete recurring expense");
  }
}
