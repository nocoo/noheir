"use server"

import { getAuthedClient } from "@/lib/api-helpers"
import type { ActionResult } from "@/lib/action-result"

export async function createProduct(data: {
  name: string
  code?: string | null
  channel?: string | null
  category?: string | null
  currency?: string
  lockPeriodDays?: number | null
  annualReturnRate?: number | null
  isArchived?: boolean
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.createProduct(userId, {
      name: data.name,
      code: data.code ?? undefined,
      channel: data.channel ?? undefined,
      category: data.category ?? undefined,
      currency: data.currency || "CNY",
      lockPeriodDays: data.lockPeriodDays ?? undefined,
      annualReturnRate: data.annualReturnRate ?? undefined,
      isArchived: data.isArchived ?? false,
    })
    const product = result.product as Record<string, unknown>
    return { success: true, data: { id: String(product.id) } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create product",
    }
  }
}

export async function updateProduct(
  id: string,
  data: {
    name?: string
    code?: string | null
    channel?: string | null
    category?: string | null
    currency?: string
    lockPeriodDays?: number | null
    annualReturnRate?: number | null
    isArchived?: boolean
  },
): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient()
    const payload: Record<string, unknown> = {}
    if (data.name !== undefined) payload.name = data.name
    // Allow explicit null to clear the field
    if (data.code !== undefined) payload.code = data.code
    if (data.channel !== undefined) payload.channel = data.channel
    if (data.category !== undefined) payload.category = data.category
    if (data.currency !== undefined) payload.currency = data.currency
    if (data.lockPeriodDays !== undefined) payload.lockPeriodDays = data.lockPeriodDays
    if (data.annualReturnRate !== undefined) payload.annualReturnRate = data.annualReturnRate
    if (data.isArchived !== undefined) payload.isArchived = data.isArchived
    await client.updateProduct(userId, id, payload)
    return { success: true, data: undefined }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update product",
    }
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient()
    await client.deleteProduct(userId, id)
    return { success: true, data: undefined }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete product",
    }
  }
}
