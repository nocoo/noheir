/**
 * Warehouse unit tooltip: unlock phase computation.
 *
 * Extracted from the tooltip component so it can be unit tested without
 * pulling in React / jsdom. Mirrors the semantics of
 * worker/lib/availability.ts so the progress bar denominator matches the
 * phase the backend put the unit in.
 */

import type { DomainProduct } from "@/domain/types";

export interface UnlockPhaseUnit {
  status: string;
  daysUntilAvailable?: number | null;
  daysUntilLocked?: number | null;
  latestInvestDate?: string | null;
  availableDateOverride?: string | null;
}

export type UnlockPhase =
  | { kind: "locked"; daysLeft: number; ratio: number | null }
  | { kind: "openWindow"; daysLeft: number; ratio: number | null }
  | { kind: "available"; ratio: null }
  | { kind: "planned"; ratio: null }
  | { kind: "archived"; ratio: null }
  | { kind: "unknown"; ratio: null };

/**
 * True iff `today` has passed the initial unlock day (override, else invest+lock).
 * Used to tell an initial lock period apart from a subsequent cyclic
 * closed window, which need different denominators for a progress bar.
 */
export function isPastInitialUnlock(
  latestInvestDate: string | null | undefined,
  lockPeriodDays: number,
  today: Date = new Date(),
  availableDateOverride?: string | null,
): boolean {
  const unlockDay = availableDateOverride || latestInvestDate;
  if (!unlockDay) return false;
  const [y, m, d] = unlockDay.split("-").map(Number);
  if (!y || !m || !d) return false;
  const unlock = new Date(y, m - 1, d);
  if (!availableDateOverride) {
    unlock.setDate(unlock.getDate() + lockPeriodDays);
  }
  unlock.setHours(0, 0, 0, 0);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  return t.getTime() >= unlock.getTime();
}

export function computeUnlockPhase(
  unit: UnlockPhaseUnit,
  product: DomainProduct | null,
  today: Date = new Date(),
): UnlockPhase {
  if (unit.status === "已归档") return { kind: "archived", ratio: null };
  if (unit.status === "计划中") return { kind: "planned", ratio: null };

  const d = unit.daysUntilAvailable;
  const dLock = unit.daysUntilLocked;
  const lockPeriod = product?.lockPeriodDays ?? null;
  const openDays = product?.openDays ?? null;
  const cycleDays = product?.cycleDays ?? null;

  if (d != null && d > 0) {
    const closedWindow =
      cycleDays != null && openDays != null && cycleDays > openDays ? cycleDays - openDays : null;
    const pastInitial =
      unit.availableDateOverride != null
        ? isPastInitialUnlock(
            unit.latestInvestDate,
            lockPeriod ?? 0,
            today,
            unit.availableDateOverride,
          )
        : lockPeriod != null && isPastInitialUnlock(unit.latestInvestDate, lockPeriod, today);
    const denom = pastInitial && closedWindow != null ? closedWindow : (lockPeriod ?? null);
    const ratio = denom && denom > 0 ? Math.max(0, Math.min(1, 1 - d / denom)) : null;
    return { kind: "locked", daysLeft: d, ratio };
  }
  if (dLock != null && dLock >= 0) {
    const ratio = openDays && openDays > 0 ? Math.max(0, Math.min(1, 1 - dLock / openDays)) : null;
    return { kind: "openWindow", daysLeft: dLock, ratio };
  }
  if (d != null && d <= 0) return { kind: "available", ratio: null };
  return { kind: "unknown", ratio: null };
}
