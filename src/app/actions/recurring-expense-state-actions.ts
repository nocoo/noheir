"use server";

// State-machine Server Actions for recurring expense rules.
// Spec: docs/002-recurring-expense-calendar.md § Server Actions
//
// The three actions here are the ONLY callers that hit the worker
// with `internal: true` (i.e. send `X-Internal-Action: 1`). The
// worker's endpoint silently drops `status` / `endedAt` from every
// other PUT body. See P1-C6 [Decision A].
//
// State transitions:
//   pause:  status = 'paused', endedAt = null
//   resume: status = 'active', endedAt = null
//   end:    status = 'ended',  endedAt = todayISO()
//
// Caller passes only the rule id; the action computes the payload
// internally so the UI cannot smuggle other state into the channel.

import { revalidatePath } from "next/cache";
import { getAuthedClient } from "@/lib/api-helpers";
import type { ActionResult } from "@/lib/action-result";
import {
  WorkerDbError,
  type RecurringExpenseStateUpdatePayload,
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

/** UTC ISO date for "today". Server Actions run on the Worker / Node
 *  runtime — we deliberately use UTC so paused/ended timestamps are
 *  consistent regardless of the user's locale (rule occurrences
 *  themselves are also UTC ISO date strings). */
function todayIsoUtc(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function applyStateTransition(
  id: string,
  payload: RecurringExpenseStateUpdatePayload,
  fallback: string,
): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient();
    await client.updateRecurringExpense(userId, id, payload, { internal: true });
    revalidatePath(PLAN_PATH);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, fallback);
  }
}

export async function pauseRecurringExpense(id: string): Promise<ActionResult> {
  return applyStateTransition(
    id,
    { status: "paused", endedAt: null },
    "Failed to pause recurring expense",
  );
}

export async function resumeRecurringExpense(id: string): Promise<ActionResult> {
  return applyStateTransition(
    id,
    { status: "active", endedAt: null },
    "Failed to resume recurring expense",
  );
}

export async function endRecurringExpense(id: string): Promise<ActionResult> {
  return applyStateTransition(
    id,
    { status: "ended", endedAt: todayIsoUtc() },
    "Failed to end recurring expense",
  );
}
