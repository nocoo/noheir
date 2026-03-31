"use server";

import { getAuthedClient } from "@/lib/api-helpers";
import type { ActionResult } from "@/lib/action-result";
import {
  parseChineseCSV,
  type ChineseCSVParseResult,
} from "@/domain/import/parse-chinese-csv";
import {
  parseChineseTransferCSV,
  type ChineseTransferCSVParseResult,
} from "@/domain/import/parse-chinese-transfer-csv";

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
  csvContent: string,
  year: number,
): Promise<ActionResult<{ imported: number }>> {
  try {
    const { userId, client } = await getAuthedClient();

    // Re-parse on server side (stateless: don't trust client-parsed data)
    const parsed: ChineseCSVParseResult = parseChineseCSV(csvContent);
    if (parsed.transactions.length === 0) {
      return {
        success: false,
        error:
          parsed.errors.length > 0
            ? (parsed.errors[0]?.message ?? "Unknown parse error")
            : "No valid transactions found in CSV",
      };
    }

    // Delete existing year data
    await client.deleteTransactionsByYear(userId, year);

    // Bulk insert
    const result = await client.bulkCreateTransactions(
      userId,
      parsed.transactions as unknown as Record<string, unknown>[],
    );

    return { success: true, data: { imported: result.inserted } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to import transactions",
    };
  }
}

// ── Transfer import ──

export async function countTransfersByYear(
  year: number,
): Promise<ActionResult<{ count: number }>> {
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
  csvContent: string,
  year: number,
): Promise<ActionResult<{ imported: number }>> {
  try {
    const { userId, client } = await getAuthedClient();

    // Re-parse on server side
    const parsed: ChineseTransferCSVParseResult =
      parseChineseTransferCSV(csvContent);
    if (parsed.transfers.length === 0) {
      return {
        success: false,
        error:
          parsed.errors.length > 0
            ? (parsed.errors[0]?.message ?? "Unknown parse error")
            : "No valid transfers found in CSV",
      };
    }

    // Delete existing year data
    await client.deleteTransfersByYear(userId, year);

    // Bulk insert
    const result = await client.bulkCreateTransfers(
      userId,
      parsed.transfers as unknown as Record<string, unknown>[],
    );

    return { success: true, data: { imported: result.inserted } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to import transfers",
    };
  }
}
