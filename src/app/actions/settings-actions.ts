"use server";

import type { AccountTypeConfig, BalanceAnchor } from "@/domain/types";
import type { ActionResult } from "@/lib/action-result";
import { getAuthedClient } from "@/lib/api-helpers";

// ── Helper: read-modify-write the settings JSON column ──

async function patchSettingsJson(
  patchFn: (parsed: Record<string, unknown>) => Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient();
    const result = await client.getSettings(userId);
    const row = (result.settings as Record<string, unknown>) ?? {};
    const rawJson = typeof row.settings === "string" ? row.settings : "{}";
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;

    const patched = patchFn(parsed);

    const payload: Record<string, unknown> = {
      settings: JSON.stringify(patched),
    };

    await client.saveSettings(userId, payload);
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save settings",
    };
  }
}

// ── General Settings ──

export async function saveGeneralSettings(data: {
  savingsRateTarget: number;
  expectedReturnRate: number;
}): Promise<ActionResult> {
  return patchSettingsJson((parsed) => ({
    ...parsed,
    savings_rate_target: data.savingsRateTarget,
    expected_return_rate: data.expectedReturnRate,
  }));
}

// ── Income Category Settings ──

export async function saveActiveIncomeCategories(categories: string[]): Promise<ActionResult> {
  return patchSettingsJson((parsed) => ({
    ...parsed,
    active_income_categories: categories,
  }));
}

// ── Expense Category Settings ──

export async function saveFixedExpenseCategories(categories: string[]): Promise<ActionResult> {
  return patchSettingsJson((parsed) => ({
    ...parsed,
    fixed_expense_categories: categories,
  }));
}

// ── Return Rate Settings ──

export async function saveReturnRateSettings(data: {
  minReturnRate: number;
  maxReturnRate: number;
}): Promise<ActionResult> {
  return patchSettingsJson((parsed) => ({
    ...parsed,
    min_return_rate: data.minReturnRate,
    max_return_rate: data.maxReturnRate,
  }));
}

// ── Balance Anchor Settings ──

export async function saveBalanceAnchors(anchors: BalanceAnchor[]): Promise<ActionResult> {
  return patchSettingsJson((parsed) => ({
    ...parsed,
    balance_anchors: anchors,
  }));
}

// ── AI Settings ──

export async function saveAiSettings(data: {
  enabled: boolean;
  baseURL: string;
  modelName: string;
  apiKey: string;
}): Promise<ActionResult> {
  return patchSettingsJson((parsed) => ({
    ...parsed,
    ai_config: {
      enabled: data.enabled,
      baseURL: data.baseURL,
      modelName: data.modelName,
      apiKey: data.apiKey,
    },
  }));
}

// ── Account Types ──

export async function saveAccountTypes(types: AccountTypeConfig[]): Promise<ActionResult> {
  return patchSettingsJson((parsed) => ({
    ...parsed,
    account_types: types,
  }));
}
