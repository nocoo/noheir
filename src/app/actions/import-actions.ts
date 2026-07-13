"use server";

import { getAuthedClient } from "@/lib/api-helpers";
import type { ActionResult } from "@/lib/action-result";

/**
 * Batch size for sending rows to the Worker's /bulk endpoint.
 * Each Worker invocation then internally batches into D1 inserts of 10 rows.
 * 100 rows per Worker call keeps the payload small and avoids CPU time limits.
 */
const WORKER_BATCH_SIZE = 100;

// ── Transaction import ──

export async function countTransactionsByYear(
  year: number,
): Promise<ActionResult<{ count: number }>> {
  try {
    const { userId, client } = await getAuthedClient();
    const result = await client.countTransactionsByYear(userId, year);
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
    const { userId, client } = await getAuthedClient();

    if (rows.length === 0) {
      return { success: false, error: "No valid transactions to import" };
    }

    // Delete existing year data
    await client.deleteTransactionsByYear(userId, year);

    // Bulk insert in batches to avoid Worker CPU time limits
    let totalInserted = 0;
    for (let i = 0; i < rows.length; i += WORKER_BATCH_SIZE) {
      const batch = rows.slice(i, i + WORKER_BATCH_SIZE);
      const result = await client.bulkCreateTransactions(userId, batch);
      totalInserted += result.inserted;
    }

    return { success: true, data: { imported: totalInserted } };
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
    const { userId, client } = await getAuthedClient();
    const result = await client.countTransfersByYear(userId, year);
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
    const { userId, client } = await getAuthedClient();

    if (rows.length === 0) {
      return { success: false, error: "No valid transfers to import" };
    }

    // Delete existing year data
    await client.deleteTransfersByYear(userId, year);

    // Bulk insert in batches to avoid Worker CPU time limits
    let totalInserted = 0;
    for (let i = 0; i < rows.length; i += WORKER_BATCH_SIZE) {
      const batch = rows.slice(i, i + WORKER_BATCH_SIZE);
      const result = await client.bulkCreateTransfers(userId, batch);
      totalInserted += result.inserted;
    }

    return { success: true, data: { imported: totalInserted } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to import transfers";
    console.error("[import-actions] deleteAndImportTransfers failed:", message, err);
    return {
      success: false,
      error: message,
    };
  }
}
