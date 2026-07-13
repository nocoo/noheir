"use server";

import type { ActionResult } from "@/lib/action-result";
import { getAuthedClient } from "@/lib/api-helpers";

export async function createContributionLog(data: {
  unitId: string;
  productId?: string | null;
  productName?: string | null;
  operationType: string;
  amount: number; // in yuan (positive = invest, negative = withdraw)
  balanceAfter?: number | null;
  operationDate: string;
  source?: string;
  note?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { userId, client } = await getAuthedClient();
    const payload: Parameters<typeof client.createContributionLog>[1] = {
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
    if (data.source) payload.source = data.source;
    if (data.note != null) payload.note = data.note;

    const result = await client.createContributionLog(userId, payload);
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
    operationDate?: string;
    note?: string | null;
  },
): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient();
    const payload: Parameters<typeof client.updateContributionLog>[2] = {};

    if (data.operationType !== undefined) payload.operationType = data.operationType;
    if (data.amount !== undefined) payload.amountCents = Math.round(data.amount * 100);
    if (data.balanceAfter !== undefined) {
      payload.balanceAfterCents =
        data.balanceAfter != null ? Math.round(data.balanceAfter * 100) : null;
    }
    if (data.operationDate !== undefined) payload.operationDate = data.operationDate;
    if (data.note !== undefined) payload.note = data.note;

    await client.updateContributionLog(userId, id, payload);
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
    const { userId, client } = await getAuthedClient();
    await client.deleteContributionLog(userId, id);
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
    const { userId, client } = await getAuthedClient();
    await client.restoreContributionLog(userId, id);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to restore contribution log",
    };
  }
}
