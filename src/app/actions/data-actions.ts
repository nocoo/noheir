"use server";

import type { ActionResult } from "@/lib/action-result";
import { getAuthedClient } from "@/lib/api-helpers";

interface BackupData {
  transactions: unknown[];
  transfers: unknown[];
  products: unknown[];
  units: unknown[];
  settings: unknown | null;
  exported_at: string;
}

export async function exportBackup(): Promise<ActionResult<BackupData>> {
  try {
    const { userId, client } = await getAuthedClient();
    const data = await client.exportData(userId);
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to export backup",
    };
  }
}

export async function restoreBackup(data: {
  transactions: unknown[];
  transfers: unknown[];
}): Promise<ActionResult<{ transactions: number; transfers: number }>> {
  try {
    const { userId, client } = await getAuthedClient();
    const result = await client.importData(userId, {
      transactions: data.transactions,
      transfers: data.transfers,
    });
    return {
      success: true,
      data: {
        transactions: result.transactions_imported,
        transfers: result.transfers_imported,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to restore backup",
    };
  }
}

export async function clearAllData(): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient();

    // Clear transactions and transfers via restore with empty arrays
    await client.importData(userId, { transactions: [], transfers: [] });

    // Delete all products
    const { products } = await client.listProducts(userId);
    for (const raw of products) {
      const p = raw as Record<string, unknown>;
      await client.deleteProduct(userId, String(p.id));
    }

    // Delete all units
    const { units } = await client.listUnits(userId);
    for (const raw of units) {
      const u = raw as Record<string, unknown>;
      await client.deleteUnit(userId, String(u.id));
    }

    // Reset settings
    await client.saveSettings(userId, { siteName: "", settings: "{}" });

    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to clear data",
    };
  }
}
