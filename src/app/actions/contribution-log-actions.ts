import type { DomainContributionLog, ExpectedUnitSnapshot } from "@/domain/types";
import type { ActionResult } from "@/lib/action-result";
import { toDomainContributionLog } from "@/lib/capital-mappers";
import { workerDbClient } from "@/lib/worker-db-client";

export async function createContributionLog(data: {
  unitId: string;
  productId?: string | null;
  productName?: string | null;
  operationType: string;
  amount: number; // in yuan (positive = invest, negative = withdraw)
  balanceAfter?: number | null;
  pnl?: number | null; // in yuan
  operationDate: string;
  source?: string;
  note?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const payload: Parameters<typeof workerDbClient.createContributionLog>[0] = {
      unitId: data.unitId,
      operationType: data.operationType,
      amountCents: Math.round(data.amount * 100),
      operationDate: data.operationDate,
    };
    if (data.productId != null) payload.productId = data.productId;
    if (data.productName != null) payload.productName = data.productName;
    if (data.balanceAfter != null) {
      payload.balanceAfterCents = Math.round(data.balanceAfter * 100);
    }
    if (data.pnl != null) payload.pnlCents = Math.round(data.pnl * 100);
    if (data.source) payload.source = data.source;
    if (data.note != null) payload.note = data.note;

    const result = await workerDbClient.createContributionLog(payload);
    const log = result.log as Record<string, unknown>;
    return { success: true, data: { id: String(log.id) } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create contribution log",
    };
  }
}

export async function updateContributionLog(
  id: string,
  data: {
    operationType?: string;
    amount?: number; // in yuan
    balanceAfter?: number | null;
    pnl?: number | null; // in yuan
    operationDate?: string;
    note?: string | null;
  },
): Promise<ActionResult> {
  try {
    const payload: Parameters<typeof workerDbClient.updateContributionLog>[1] = {};

    if (data.operationType !== undefined) payload.operationType = data.operationType;
    if (data.amount !== undefined) payload.amountCents = Math.round(data.amount * 100);
    if (data.balanceAfter !== undefined) {
      payload.balanceAfterCents =
        data.balanceAfter != null ? Math.round(data.balanceAfter * 100) : null;
    }
    if (data.pnl !== undefined) {
      payload.pnlCents = data.pnl != null ? Math.round(data.pnl * 100) : null;
    }
    if (data.operationDate !== undefined) payload.operationDate = data.operationDate;
    if (data.note !== undefined) payload.note = data.note;

    await workerDbClient.updateContributionLog(id, payload);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update contribution log",
    };
  }
}

export async function deleteContributionLog(id: string): Promise<ActionResult> {
  try {
    await workerDbClient.deleteContributionLog(id);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete contribution log",
    };
  }
}

export async function restoreContributionLog(id: string): Promise<ActionResult> {
  try {
    await workerDbClient.restoreContributionLog(id);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to restore contribution log",
    };
  }
}

/** Fetch one unit's timeline plus the raw snapshot used as the commit anchor. */
export async function listUnitContributionLogs(unitId: string): Promise<
  ActionResult<{
    logs: DomainContributionLog[];
    expected: ExpectedUnitSnapshot;
    currentProductName: string | null;
    availableDate: string | null;
    latestInvestDate: string | null;
  }>
> {
  try {
    const result = await workerDbClient.listUnitLogs(unitId);
    return {
      success: true,
      data: {
        logs: result.logs.map((raw) => toDomainContributionLog(raw as Record<string, unknown>)),
        expected: result.expected,
        currentProductName: result.currentProductName,
        availableDate: result.availableDate ?? null,
        latestInvestDate: result.latestInvestDate ?? null,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load unit logs",
    };
  }
}

/**
 * Atomic commit of metadata edits + staged operations + one audit note.
 * `expected` must be the raw snapshot from listUnitContributionLogs.
 */
export async function commitUnit(
  unitId: string,
  payload: {
    expected: ExpectedUnitSnapshot;
    metadata?: Record<string, unknown>;
    operations?: Array<Record<string, unknown>>;
    operationDate?: string;
    commitNote?: string | null;
  },
): Promise<ActionResult> {
  try {
    await workerDbClient.commitUnit(unitId, payload);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to commit unit changes",
    };
  }
}
