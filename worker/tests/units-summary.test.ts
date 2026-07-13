/**
 * Unit tests for units-summary.ts
 */

import { describe, expect, test } from "vitest";
import type { UnitWithAvailability } from "../db/repositories/units";
import { buildUnitsSummary } from "../lib/units-summary";

// Helper to create mock unit
function mockUnit(overrides: Partial<UnitWithAvailability> = {}): UnitWithAvailability {
  return {
    id: "test-id",
    userId: "test-user",
    unitCode: "U-001",
    amountCents: 100000,
    currency: "CNY",
    status: "已成立",
    strategy: "短期理财",
    tactics: "理财产品",
    productId: null,
    startDate: null,
    endDate: null,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: null,
    availableDate: null,
    isAvailable: false,
    daysUntilAvailable: null,
    latestInvestDate: null,
    ...overrides,
  };
}

describe("buildUnitsSummary", () => {
  test("returns empty summary for empty array", () => {
    const summary = buildUnitsSummary([]);

    expect(summary.total_count).toBe(0);
    expect(summary.total_amount_cents).toBe(0);
    expect(Object.keys(summary.by_strategy)).toHaveLength(0);
    expect(Object.keys(summary.by_status)).toHaveLength(0);
    expect(Object.keys(summary.by_tactics)).toHaveLength(0);
    expect(summary.availability).toEqual({
      available_now: { count: 0, amount_cents: 0 },
      available_30d: { count: 0, amount_cents: 0 },
      locked: { count: 0, amount_cents: 0 },
      unknown: { count: 0, amount_cents: 0 },
    });
  });

  test("aggregates totals correctly", () => {
    const units = [
      mockUnit({ amountCents: 100000 }),
      mockUnit({ amountCents: 200000 }),
      mockUnit({ amountCents: 300000 }),
    ];

    const summary = buildUnitsSummary(units);

    expect(summary.total_count).toBe(3);
    expect(summary.total_amount_cents).toBe(600000);
  });

  test("groups by strategy", () => {
    const units = [
      mockUnit({ strategy: "短期理财", amountCents: 100000 }),
      mockUnit({ strategy: "短期理财", amountCents: 200000 }),
      mockUnit({ strategy: "长期理财", amountCents: 300000 }),
    ];

    const summary = buildUnitsSummary(units);

    expect(summary.by_strategy.短期理财).toEqual({ count: 2, amount_cents: 300000 });
    expect(summary.by_strategy.长期理财).toEqual({ count: 1, amount_cents: 300000 });
  });

  test("groups by status", () => {
    const units = [
      mockUnit({ status: "已成立", amountCents: 100000 }),
      mockUnit({ status: "已成立", amountCents: 200000 }),
      mockUnit({ status: "计划中", amountCents: 300000 }),
    ];

    const summary = buildUnitsSummary(units);

    expect(summary.by_status.已成立).toEqual({ count: 2, amount_cents: 300000 });
    expect(summary.by_status.计划中).toEqual({ count: 1, amount_cents: 300000 });
  });

  test("groups by tactics", () => {
    const units = [
      mockUnit({ tactics: "理财产品", amountCents: 100000 }),
      mockUnit({ tactics: "债券基金", amountCents: 200000 }),
      mockUnit({ tactics: "理财产品", amountCents: 300000 }),
    ];

    const summary = buildUnitsSummary(units);

    expect(summary.by_tactics.理财产品).toEqual({ count: 2, amount_cents: 400000 });
    expect(summary.by_tactics.债券基金).toEqual({ count: 1, amount_cents: 200000 });
  });

  test("categorizes availability: available_now when daysUntilAvailable <= 0", () => {
    const units = [
      mockUnit({
        amountCents: 100000,
        availableDate: "2026-04-01",
        isAvailable: true,
        daysUntilAvailable: 0,
      }),
      mockUnit({
        amountCents: 200000,
        availableDate: "2026-03-01",
        isAvailable: true,
        daysUntilAvailable: -30, // Already available for 30 days
      }),
    ];

    const summary = buildUnitsSummary(units);

    expect(summary.availability.available_now).toEqual({ count: 2, amount_cents: 300000 });
  });

  test("categorizes availability: available_30d when 1-30 days", () => {
    const units = [
      mockUnit({
        amountCents: 100000,
        availableDate: "2026-04-15",
        isAvailable: false,
        daysUntilAvailable: 10,
      }),
      mockUnit({
        amountCents: 200000,
        availableDate: "2026-05-01",
        isAvailable: false,
        daysUntilAvailable: 30,
      }),
    ];

    const summary = buildUnitsSummary(units);

    expect(summary.availability.available_30d).toEqual({ count: 2, amount_cents: 300000 });
  });

  test("categorizes availability: locked when > 30 days", () => {
    const units = [
      mockUnit({
        amountCents: 100000,
        availableDate: "2026-06-01",
        isAvailable: false,
        daysUntilAvailable: 60,
      }),
      mockUnit({
        amountCents: 500000,
        availableDate: "2027-01-01",
        isAvailable: false,
        daysUntilAvailable: 270,
      }),
    ];

    const summary = buildUnitsSummary(units);

    expect(summary.availability.locked).toEqual({ count: 2, amount_cents: 600000 });
  });

  test("categorizes availability: unknown when no availability data", () => {
    const units = [
      mockUnit({ amountCents: 100000, availableDate: null, daysUntilAvailable: null }),
      mockUnit({ amountCents: 200000, availableDate: null, daysUntilAvailable: null }),
    ];

    const summary = buildUnitsSummary(units);

    expect(summary.availability.unknown).toEqual({ count: 2, amount_cents: 300000 });
  });

  test("handles mixed availability categories", () => {
    const units = [
      // available_now
      mockUnit({ amountCents: 100000, availableDate: "2026-04-01", daysUntilAvailable: 0 }),
      // available_30d
      mockUnit({ amountCents: 200000, availableDate: "2026-04-20", daysUntilAvailable: 15 }),
      // locked
      mockUnit({ amountCents: 300000, availableDate: "2026-07-01", daysUntilAvailable: 90 }),
      // unknown
      mockUnit({ amountCents: 400000, availableDate: null, daysUntilAvailable: null }),
    ];

    const summary = buildUnitsSummary(units);

    expect(summary.total_count).toBe(4);
    expect(summary.total_amount_cents).toBe(1000000);
    expect(summary.availability.available_now).toEqual({ count: 1, amount_cents: 100000 });
    expect(summary.availability.available_30d).toEqual({ count: 1, amount_cents: 200000 });
    expect(summary.availability.locked).toEqual({ count: 1, amount_cents: 300000 });
    expect(summary.availability.unknown).toEqual({ count: 1, amount_cents: 400000 });
  });

  test("skips null strategy/status/tactics in grouping", () => {
    const units = [mockUnit({ strategy: null, status: null, tactics: null, amountCents: 100000 })];

    const summary = buildUnitsSummary(units);

    expect(summary.total_count).toBe(1);
    expect(Object.keys(summary.by_strategy)).toHaveLength(0);
    expect(Object.keys(summary.by_status)).toHaveLength(0);
    expect(Object.keys(summary.by_tactics)).toHaveLength(0);
  });
});
