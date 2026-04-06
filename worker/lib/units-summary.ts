/**
 * Units summary aggregation logic.
 *
 * Computes aggregated statistics for capital units including:
 * - Total count and amount
 * - Breakdown by strategy, status, tactics
 * - Availability categorization (available_now, available_30d, locked, unknown)
 */

import type { UnitWithAvailability } from "../db/repositories/units";

export interface GroupStats {
  count: number;
  amount_cents: number;
}

export interface UnitsSummary {
  total_count: number;
  total_amount_cents: number;
  by_strategy: Record<string, GroupStats>;
  by_status: Record<string, GroupStats>;
  by_tactics: Record<string, GroupStats>;
  availability: {
    available_now: GroupStats;
    available_30d: GroupStats;
    locked: GroupStats;
    unknown: GroupStats;
  };
}

/**
 * Aggregate units into a summary.
 *
 * @param units - Units with computed availability info
 */
export function buildUnitsSummary(units: UnitWithAvailability[]): UnitsSummary {
  const summary: UnitsSummary = {
    total_count: 0,
    total_amount_cents: 0,
    by_strategy: {},
    by_status: {},
    by_tactics: {},
    availability: {
      available_now: { count: 0, amount_cents: 0 },
      available_30d: { count: 0, amount_cents: 0 },
      locked: { count: 0, amount_cents: 0 },
      unknown: { count: 0, amount_cents: 0 },
    },
  };

  for (const unit of units) {
    const amount = unit.amountCents;

    // Total
    summary.total_count++;
    summary.total_amount_cents += amount;

    // By strategy
    if (unit.strategy) {
      const key = unit.strategy;
      if (!summary.by_strategy[key]) {
        summary.by_strategy[key] = { count: 0, amount_cents: 0 };
      }
      const stats = summary.by_strategy[key];
      if (stats) {
        stats.count++;
        stats.amount_cents += amount;
      }
    }

    // By status
    if (unit.status) {
      const key = unit.status;
      if (!summary.by_status[key]) {
        summary.by_status[key] = { count: 0, amount_cents: 0 };
      }
      const stats = summary.by_status[key];
      if (stats) {
        stats.count++;
        stats.amount_cents += amount;
      }
    }

    // By tactics
    if (unit.tactics) {
      const key = unit.tactics;
      if (!summary.by_tactics[key]) {
        summary.by_tactics[key] = { count: 0, amount_cents: 0 };
      }
      const stats = summary.by_tactics[key];
      if (stats) {
        stats.count++;
        stats.amount_cents += amount;
      }
    }

    // Availability categorization
    if (unit.availableDate === null || unit.daysUntilAvailable === null) {
      // No availability data
      summary.availability.unknown.count++;
      summary.availability.unknown.amount_cents += amount;
    } else if (unit.daysUntilAvailable <= 0) {
      // Available now
      summary.availability.available_now.count++;
      summary.availability.available_now.amount_cents += amount;
    } else if (unit.daysUntilAvailable <= 30) {
      // Available within 30 days
      summary.availability.available_30d.count++;
      summary.availability.available_30d.amount_cents += amount;
    } else {
      // Locked (> 30 days)
      summary.availability.locked.count++;
      summary.availability.locked.amount_cents += amount;
    }
  }

  return summary;
}
