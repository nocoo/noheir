"use server"

import { getAuthedClient } from "@/lib/api-helpers"
import type { ActionResult } from "@/lib/action-result"
import type { AccountTypeConfig } from "@/domain/types"

// ── Helper: read-modify-write the settings JSON column ──

async function patchSettingsJson(
  patchFn: (parsed: Record<string, unknown>) => Record<string, unknown>,
  extraFields?: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.getSettings(userId)
    const row = (result.settings as Record<string, unknown>) ?? {}
    const rawJson = typeof row.settings === "string" ? row.settings : "{}"
    const parsed = JSON.parse(rawJson) as Record<string, unknown>

    const patched = patchFn(parsed)

    const payload: Record<string, unknown> = {
      settings: JSON.stringify(patched),
      ...extraFields,
    }

    await client.upsertSettings(userId, payload)
    return { success: true, data: undefined }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save settings",
    }
  }
}

// ── General Settings ──

export async function saveGeneralSettings(data: {
  siteName: string
  savingsRateTarget: number
  expectedReturnRate: number
  darkMode: boolean
}): Promise<ActionResult> {
  return patchSettingsJson(
    (parsed) => ({
      ...parsed,
      savings_rate_target: data.savingsRateTarget,
      expected_return_rate: data.expectedReturnRate,
      dark_mode: data.darkMode,
    }),
    { siteName: data.siteName },
  )
}

// ── AI Settings ──

export async function saveAiSettings(data: {
  enabled: boolean
  baseURL: string
  modelName: string
  apiKey: string
}): Promise<ActionResult> {
  return patchSettingsJson((parsed) => ({
    ...parsed,
    ai_config: {
      enabled: data.enabled,
      baseURL: data.baseURL,
      modelName: data.modelName,
      apiKey: data.apiKey,
    },
  }))
}

// ── Account Types ──

export async function saveAccountTypes(
  types: AccountTypeConfig[],
): Promise<ActionResult> {
  return patchSettingsJson((parsed) => ({
    ...parsed,
    account_types: types,
  }))
}
