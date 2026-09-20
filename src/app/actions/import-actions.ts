import type { ActionResult } from "@/lib/action-result";
import { workerDbClient } from "@/lib/worker-db-client";

// ── Transaction import ──

export async function countTransactionsByYear(
  year: number,
): Promise<ActionResult<{ count: number }>> {
  try {
    const result = await workerDbClient.countTransactionsByYear(year);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to count transactions",
    };
  }
}

export async function deleteAndImportTransactions(
  rows: Record<string, unknown>[],
  year: number,
): Promise<ActionResult<{ imported: number }>> {
  try {
    if (rows.length === 0) {
      return { success: false, error: "No valid transactions to import" };
    }

    // Atomic import replaces old rows for year in one backend batch
    const result = await workerDbClient.importTransactions(year, rows);
    return { success: true, data: { imported: result.imported } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import transactions";
    console.error("[import-actions] deleteAndImportTransactions failed:", message);
    return {
      success: false,
      error: message,
    };
  }
}

// ── Transfer import ──

export async function countTransfersByYear(year: number): Promise<ActionResult<{ count: number }>> {
  try {
    const result = await workerDbClient.countTransfersByYear(year);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to count transfers",
    };
  }
}

export async function deleteAndImportTransfers(
  rows: Record<string, unknown>[],
  year: number,
): Promise<ActionResult<{ imported: number }>> {
  try {
    if (rows.length === 0) {
      return { success: false, error: "No valid transfers to import" };
    }

    // Atomic import replaces old rows for year in one backend batch
    const result = await workerDbClient.importTransfers(year, rows);
    return { success: true, data: { imported: result.imported } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import transfers";
    console.error("[import-actions] deleteAndImportTransfers failed:", message, err);
    return {
      success: false,
      error: message,
    };
  }
}
