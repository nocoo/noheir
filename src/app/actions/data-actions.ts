import type { ActionResult } from "@/lib/action-result";
import { workerDbClient } from "@/lib/worker-db-client";

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
    const data = await workerDbClient.exportData();
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
    const result = await workerDbClient.importData({
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
    // Clear transactions and transfers via restore with empty arrays
    await workerDbClient.importData({ transactions: [], transfers: [] });

    // Delete all products
    const { products } = await workerDbClient.listProducts();
    for (const raw of products) {
      const p = raw as Record<string, unknown>;
      await workerDbClient.deleteProduct(String(p.id));
    }

    // Delete all units
    const { units } = await workerDbClient.listUnits();
    for (const raw of units) {
      const u = raw as Record<string, unknown>;
      await workerDbClient.deleteUnit(String(u.id));
    }

    // Reset settings
    await workerDbClient.saveSettings({ siteName: "", settings: "{}" });

    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to clear data",
    };
  }
}
