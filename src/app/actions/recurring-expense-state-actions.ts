"use server";

// State-machine Server Actions for recurring expense rules.
// Spec: docs/002-recurring-expense-calendar.md § Server Actions
//
// The three actions here are the ONLY callers that hit the worker
// with `internal: true` (i.e. send `X-Internal-Action: 1`). The
// worker's endpoint silently drops `status` / `endedAt` from every
// other PUT body. See P1-C6 [Decision A].
//
// Legal transition matrix (rejected illegal calls do NOT touch the worker):
//   pause:  active           -> paused
//   resume: paused           -> active
//   end:    active | paused  -> ended       (ended is terminal)
//
// Caller passes only the rule id; the action computes the payload
// internally so the UI cannot smuggle other state into the channel.

import { revalidatePath } from "next/cache";
import { getAuthedClient } from "@/lib/api-helpers";
import type { ActionResult } from "@/lib/action-result";
import {
  WorkerDbError,
  type RawRecurringExpense,
  type RecurringExpenseStateUpdatePayload,
} from "@/lib/worker-db-client";

const PLAN_PATH = "/plan";

type RuleStatus = "active" | "paused" | "ended";
type Transition = "pause" | "resume" | "end";

const ALLOWED_FROM: Record<Transition, ReadonlyArray<RuleStatus>> = {
  pause: ["active"],
  resume: ["paused"],
  end: ["active", "paused"],
};

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

function normalizeStatus(raw: string): RuleStatus {
  if (raw === "active" || raw === "paused" || raw === "ended") return raw;
  throw new Error(`Unknown rule status from worker: ${raw}`);
}

function illegalTransitionMessage(transition: Transition, from: RuleStatus): string {
  // Human-readable Chinese message — surfaces in UI toasts.
  const verbs: Record<Transition, string> = {
    pause: "暂停",
    resume: "恢复",
    end: "结束",
  };
  const labels: Record<RuleStatus, string> = {
    active: "进行中",
    paused: "已暂停",
    ended: "已结束",
  };
  return `当前状态为「${labels[from]}」，无法${verbs[transition]}`;
}

async function findRule(
  client: { listRecurringExpenses: (uid: string) => Promise<{ rules: RawRecurringExpense[] }> },
  userId: string,
  id: string,
): Promise<RawRecurringExpense | null> {
  const { rules } = await client.listRecurringExpenses(userId);
  return rules.find((r) => r.id === id) ?? null;
}

async function applyStateTransition(
  id: string,
  transition: Transition,
  payload: RecurringExpenseStateUpdatePayload,
  fallback: string,
): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient();

    const rule = await findRule(client, userId, id);
    if (!rule) {
      return { success: false, error: "规则不存在" };
    }

    const current = normalizeStatus(rule.status);
    if (!ALLOWED_FROM[transition].includes(current)) {
      return { success: false, error: illegalTransitionMessage(transition, current) };
    }

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
    "pause",
    { status: "paused", endedAt: null },
    "Failed to pause recurring expense",
  );
}

export async function resumeRecurringExpense(id: string): Promise<ActionResult> {
  return applyStateTransition(
    id,
    "resume",
    { status: "active", endedAt: null },
    "Failed to resume recurring expense",
  );
}

export async function endRecurringExpense(id: string): Promise<ActionResult> {
  return applyStateTransition(
    id,
    "end",
    { status: "ended", endedAt: todayIsoUtc() },
    "Failed to end recurring expense",
  );
}
