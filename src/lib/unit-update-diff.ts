import type { updateUnit } from "@/app/actions/unit-actions";

export type UnitUpdatePayload = Parameters<typeof updateUnit>[1];

export interface UnitFormSnapshot {
  unitCode: string;
  amount: number;
  currency: string;
  status: string;
  strategy: string;
  tactics: string;
  productId: string | null;
  startDate: string | null;
  note: string | null;
}

/**
 * Compute the minimal update payloads to send for a unit edit.
 *
 * Worker enforces that `productId` must be updated alone (auto-logging side effect).
 * So we always emit at most TWO payloads:
 *   1) productId-only (only if productId actually changed)
 *   2) all other changed fields
 *
 * Either may be empty (caller should skip empty payloads).
 */
export function buildUnitUpdateDiff(
  initial: UnitFormSnapshot,
  current: UnitFormSnapshot,
): { productIdPayload: UnitUpdatePayload | null; otherPayload: UnitUpdatePayload | null } {
  let productIdPayload: UnitUpdatePayload | null = null;
  if (initial.productId !== current.productId) {
    productIdPayload = { productId: current.productId };
  }

  const other: UnitUpdatePayload = {};
  if (initial.unitCode !== current.unitCode) other.unitCode = current.unitCode;
  if (initial.amount !== current.amount) other.amount = current.amount;
  if (initial.currency !== current.currency) other.currency = current.currency;
  if (initial.status !== current.status) other.status = current.status;
  if (initial.strategy !== current.strategy) other.strategy = current.strategy;
  if (initial.tactics !== current.tactics) other.tactics = current.tactics;
  if (initial.startDate !== current.startDate) other.startDate = current.startDate;
  if (initial.note !== current.note) other.note = current.note;

  const otherPayload = Object.keys(other).length > 0 ? other : null;
  return { productIdPayload, otherPayload };
}
