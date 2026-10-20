import type { ActionResult } from "@/lib/action-result";
import { WorkerDbError, workerDbClient } from "@/lib/worker-db-client";

function actionError(err: unknown, fallback: string): { success: false; error: string } {
  if (err instanceof WorkerDbError) {
    return { success: false, error: err.message };
  }
  if (err instanceof Error) {
    return { success: false, error: err.message };
  }
  return { success: false, error: fallback };
}

export async function pauseRecurringExpense(
  id: string,
  version: number | undefined,
): Promise<ActionResult> {
  try {
    await workerDbClient.transitionRecurringExpense(id, "pause", version);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to pause recurring expense");
  }
}

export async function resumeRecurringExpense(
  id: string,
  version: number | undefined,
): Promise<ActionResult> {
  try {
    await workerDbClient.transitionRecurringExpense(id, "resume", version);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to resume recurring expense");
  }
}

export async function endRecurringExpense(
  id: string,
  version: number | undefined,
): Promise<ActionResult> {
  try {
    await workerDbClient.transitionRecurringExpense(id, "end", version);
    return { success: true, data: undefined };
  } catch (err) {
    return actionError(err, "Failed to end recurring expense");
  }
}
