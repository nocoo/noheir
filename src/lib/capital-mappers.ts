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
      raw.lockPeriodDays != null ? Number(raw.lockPeriodDays) : null,
    annualReturnRate:
      raw.annualReturnRate != null ? Number(raw.annualReturnRate) : null,
  }
}

export function toDomainUnit(raw: Record<string, unknown>): DomainUnit {
  const product = raw.product as Record<string, unknown> | null | undefined
  return {
    id: String(raw.id ?? ""),
    unitCode: String(raw.unitCode ?? ""),
    amount: Number(raw.amountCents ?? 0) / 100,
    currency: (String(raw.currency ?? "CNY")) as Currency,
    status: String(raw.status ?? "已成立") as UnitStatus,
    strategy: String(raw.strategy ?? "") as InvestmentStrategy,
    tactics: String(raw.tactics ?? "") as InvestmentTactics,
    productId: raw.productId != null ? String(raw.productId) : null,
    startDate: raw.startDate != null ? String(raw.startDate) : null,
    endDate: raw.endDate != null ? String(raw.endDate) : null,
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
