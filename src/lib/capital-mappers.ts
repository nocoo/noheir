/**
 * Mappers for products and units from Worker API responses.
 */

import type {
  ContributionOperationType,
  ContributionSource,
  Currency,
  DomainContributionLog,
  DomainProduct,
  DomainUnit,
  InvestmentStrategy,
  InvestmentTactics,
  UnitDisplayInfo,
  UnitStatus,
} from "@/domain/types";

export function toDomainProduct(raw: Record<string, unknown>): DomainProduct {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    code: raw.code != null ? String(raw.code) : null,
    channel: raw.channel != null ? String(raw.channel) : null,
    category: raw.category != null ? String(raw.category) : null,
    currency: raw.currency != null ? String(raw.currency) : null,
    lockPeriodDays: raw.lockPeriodDays != null ? Number(raw.lockPeriodDays) : null,
    openDays: raw.openDays != null ? Number(raw.openDays) : null,
    cycleDays: raw.cycleDays != null ? Number(raw.cycleDays) : null,
    annualReturnRate: raw.annualReturnRate != null ? Number(raw.annualReturnRate) : null,
    isArchived: Boolean(raw.isArchived),
  };
}

export function toDomainUnit(raw: Record<string, unknown>): DomainUnit {
  const product = raw.product as Record<string, unknown> | null | undefined;
  return {
    id: String(raw.id ?? ""),
    unitCode: String(raw.unitCode ?? ""),
    amount: Number(raw.amountCents ?? 0) / 100,
    currency: String(raw.currency ?? "CNY") as Currency,
    status: String(raw.status ?? "已成立") as UnitStatus,
    strategy: String(raw.strategy ?? "") as InvestmentStrategy,
    tactics: String(raw.tactics ?? "") as InvestmentTactics,
    productId: raw.productId != null ? String(raw.productId) : null,
    startDate: raw.startDate != null ? String(raw.startDate) : null,
    endDate: raw.endDate != null ? String(raw.endDate) : null,
    note: raw.note != null ? String(raw.note) : null,
    product: product ? toDomainProduct(product) : null,
  };
}

/**
 * Maps raw API unit response (with availability fields) to UnitDisplayInfo.
 * Availability fields (availableDate, isAvailable, daysUntilAvailable, latestInvestDate)
 * are computed by the backend and passed through directly.
 */
export function toUnitDisplayInfo(raw: Record<string, unknown>): UnitDisplayInfo {
  const unit = toDomainUnit(raw);
  return {
    ...unit,
    availableDate: raw.availableDate != null ? String(raw.availableDate) : null,
    isAvailable: Boolean(raw.isAvailable),
    daysUntilAvailable: raw.daysUntilAvailable != null ? Number(raw.daysUntilAvailable) : null,
    daysUntilLocked: raw.daysUntilLocked != null ? Number(raw.daysUntilLocked) : null,
    latestInvestDate: raw.latestInvestDate != null ? String(raw.latestInvestDate) : null,
  };
}

export function toDomainContributionLog(raw: Record<string, unknown>): DomainContributionLog {
  const unit = raw.unit as Record<string, unknown> | null | undefined;
  const product = raw.product as Record<string, unknown> | null | undefined;

  return {
    id: String(raw.id ?? ""),
    unitId: String(raw.unitId ?? ""),
    productId: raw.productId != null ? String(raw.productId) : null,
    productName: raw.productName != null ? String(raw.productName) : null,
    operationType: String(raw.operationType ?? "invest") as ContributionOperationType,
    amount: Number(raw.amountCents ?? 0) / 100, // cents to yuan
    balanceAfter: raw.balanceAfterCents != null ? Number(raw.balanceAfterCents) / 100 : null,
    pnl: raw.pnlCents != null ? Number(raw.pnlCents) / 100 : null,
    operationDate: String(raw.operationDate ?? ""),
    source: String(raw.source ?? "manual") as ContributionSource,
    note: raw.note != null ? String(raw.note) : null,
    unit: unit ? toDomainUnit(unit) : null,
    product: product ? toDomainProduct(product) : null,
    isDeleted: raw.deletedAt != null,
    // Prefer the server-normalized value: raw createdAt has three incompatible
    // encodings in production, and `new Date(<ISO string>)` via Number() would
    // yield Invalid Date. See docs/003 § B1.
    createdAt: new Date(Number(raw.createdAtMs ?? raw.createdAt ?? 0)),
  };
}
