"use server"

import { getAuthedClient } from "@/lib/api-helpers"
import type { ActionResult } from "@/lib/action-result"

export async function createUnit(data: {
  unitCode: string
  amount: number // in yuan (display value)
  currency: string
  status: string
  strategy: string
  tactics: string
  productId?: string
  startDate?: string
  endDate?: string
  note?: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    const { userId, client } = await getAuthedClient()
    const payload: Record<string, unknown> = {
      unit_code: data.unitCode,
      amount_cents: Math.round(data.amount * 100),
      currency: data.currency,
      status: data.status,
      strategy: data.strategy,
      tactics: data.tactics,
    }
    if (data.productId) payload.product_id = data.productId
    if (data.startDate) payload.start_date = data.startDate
    if (data.endDate) payload.end_date = data.endDate
    if (data.note) payload.note = data.note

    const result = await client.createUnit(userId, payload)
    const unit = result.unit as Record<string, unknown>
    return { success: true, data: { id: String(unit.id) } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create unit",
    }
  }
}

export async function updateUnit(
  id: string,
  data: {
    unitCode?: string
    amount?: number // in yuan (display value)
    currency?: string
    status?: string
    strategy?: string
    tactics?: string
    productId?: string | null
    startDate?: string | null
    endDate?: string | null
    note?: string | null
  },
): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient()
    const payload: Record<string, unknown> = {}
    if (data.unitCode !== undefined) payload.unit_code = data.unitCode
    if (data.amount !== undefined)
      payload.amount_cents = Math.round(data.amount * 100)
    if (data.currency !== undefined) payload.currency = data.currency
    if (data.status !== undefined) payload.status = data.status
    if (data.strategy !== undefined) payload.strategy = data.strategy
    if (data.tactics !== undefined) payload.tactics = data.tactics
    if (data.productId !== undefined) payload.product_id = data.productId
    if (data.startDate !== undefined) payload.start_date = data.startDate
    if (data.endDate !== undefined) payload.end_date = data.endDate
    if (data.note !== undefined) payload.note = data.note

    await client.updateUnit(userId, id, payload)
    return { success: true, data: undefined }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update unit",
    }
  }
}

export async function deleteUnit(id: string): Promise<ActionResult> {
  try {
    const { userId, client } = await getAuthedClient()
    await client.deleteUnit(userId, id)
    return { success: true, data: undefined }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete unit",
    }
  }
}
