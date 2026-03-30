/**
 * Mappers for products and units from Worker API responses.
 */

import type {
  DomainProduct,
  DomainUnit,
  UnitDisplayInfo,
  Currency,
  InvestmentStrategy,
  InvestmentTactics,
  UnitStatus,
} from "@/domain/types"

export function toDomainProduct(raw: Record<string, unknown>): DomainProduct {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    code: raw.code != null ? String(raw.code) : null,
    channel: raw.channel != null ? String(raw.channel) : null,
    category: raw.category != null ? String(raw.category) : null,
    currency: raw.currency != null ? String(raw.currency) : null,
    lockPeriodDays:
      raw.lock_period_days != null ? Number(raw.lock_period_days) : null,
    annualReturnRate:
      raw.annual_return_rate != null ? Number(raw.annual_return_rate) : null,
  }
}

export function toDomainUnit(raw: Record<string, unknown>): DomainUnit {
  const product = raw.product as Record<string, unknown> | null | undefined
  return {
    id: String(raw.id ?? ""),
    unitCode: String(raw.unit_code ?? ""),
    amount: Number(raw.amount_cents ?? 0) / 100,
    currency: (String(raw.currency ?? "CNY")) as Currency,
    status: String(raw.status ?? "已成立") as UnitStatus,
    strategy: String(raw.strategy ?? "") as InvestmentStrategy,
    tactics: String(raw.tactics ?? "") as InvestmentTactics,
    productId: raw.product_id != null ? String(raw.product_id) : null,
    startDate: raw.start_date != null ? String(raw.start_date) : null,
    endDate: raw.end_date != null ? String(raw.end_date) : null,
    note: raw.note != null ? String(raw.note) : null,
    product: product ? toDomainProduct(product) : null,
  }
}

export function toUnitDisplayInfo(unit: DomainUnit): UnitDisplayInfo {
  const today = new Date()

  if (unit.endDate) {
    const end = new Date(unit.endDate)
    const daysUntilMaturity = Math.ceil(
      (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )
    return {
      ...unit,
      daysUntilMaturity,
      isAvailable: daysUntilMaturity <= 0,
    }
  }

  return { ...unit }
}
