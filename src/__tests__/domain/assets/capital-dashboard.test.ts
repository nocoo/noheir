import { describe, expect, it } from "bun:test";
import {
  buildCurrencyDistribution,
  buildDeploymentRate,
  buildIdleUnits,
  buildIncomingLiquidity,
  buildAvailabilityDistribution,
  buildStatusDistribution,
  buildStrategyChartData,
  buildTotalAssetsAll,
  buildTotalAssetsByCurrency,
} from "@/domain/assets/capital-dashboard";
import type { UnitDisplayInfo } from "@/domain/types";

const makeUnit = (
  overrides: Partial<UnitDisplayInfo> = {},
): UnitDisplayInfo => ({
  id: "1",
  unitCode: "A01",
  amount: 100,
  currency: "CNY",
  status: "已成立",
  strategy: "长期理财",
  tactics: "稳健理财",
  productId: null,
  startDate: null,
  endDate: null,
  note: null,
  availableDate: null,
  isAvailable: false,
  daysUntilAvailable: null,
  latestInvestDate: null,
  ...overrides,
});

describe("capital-dashboard domain", () => {
  it("calculates totals by currency and total assets", () => {
    const totals = buildTotalAssetsByCurrency([
      makeUnit({ currency: "CNY", amount: 100 }),
      makeUnit({ currency: "USD", amount: 50 }),
    ]);
    expect(totals.CNY).toBe(100);
    expect(buildTotalAssetsAll(totals)).toBe(150);
  });

  it("builds deployment rate", () => {
    expect(
      buildDeploymentRate({
        total_assets: 100,
        invested_amount: 20,
        upcoming_maturities: [],
      }),
    ).toBe(20);
  });

  it("builds idle units", () => {
    const idle = buildIdleUnits([
      makeUnit(),
      makeUnit({ product: { id: "p1", name: "X", code: null, channel: null, category: null, currency: null, lockPeriodDays: null, annualReturnRate: null, isArchived: false } }),
    ]);
    expect(idle.length).toBe(1);
  });

  it("builds incoming liquidity", () => {
    const incoming = buildIncomingLiquidity({
      total_assets: 0,
      invested_amount: 0,
      upcoming_maturities: [{ amount: 10 }, { amount: 20 }],
    });
    expect(incoming.total).toBe(30);
    expect(incoming.count).toBe(2);
  });

  it("builds distributions", () => {
    const units = [
      makeUnit({ amount: 100 }),
      makeUnit({ amount: 50 }),
    ];
    const currency = buildCurrencyDistribution(units, 150);
    expect(currency[0]?.percentage).toBeCloseTo(100);

    const status = buildStatusDistribution(units, 150);
    expect(status[0]?.amount).toBe(150);

    const availability = buildAvailabilityDistribution(
      [makeUnit({ availableDate: "2024-01-10", isAvailable: true })],
      100,
    );
    expect(availability[0]?.period).toBe("已可用");
  });

  it("buckets availability into 7d, 30d, 90d, beyond", () => {
    const units = [
      makeUnit({ availableDate: "2026-01-01", isAvailable: false, daysUntilAvailable: 3, amount: 10 }),
      makeUnit({ availableDate: "2026-01-01", isAvailable: false, daysUntilAvailable: 15, amount: 20 }),
      makeUnit({ availableDate: "2026-01-01", isAvailable: false, daysUntilAvailable: 60, amount: 30 }),
      makeUnit({ availableDate: "2026-01-01", isAvailable: false, daysUntilAvailable: 120, amount: 40 }),
    ];
    const result = buildAvailabilityDistribution(units, 100);
    expect(result.find((r) => r.period === "7天内")?.amount).toBe(10);
    expect(result.find((r) => r.period === "30天内")?.amount).toBe(20);
    expect(result.find((r) => r.period === "90天内")?.amount).toBe(30);
    expect(result.find((r) => r.period === "90天以上")?.amount).toBe(40);
  });

  it("skips units without availableDate or not established", () => {
    const units = [
      makeUnit({ availableDate: null, daysUntilAvailable: 5, amount: 10 }),
      makeUnit({ availableDate: "2026-01-01", status: "计划中", daysUntilAvailable: 5, amount: 10 }),
    ];
    const result = buildAvailabilityDistribution(units, 100);
    expect(result).toHaveLength(0);
  });

  it("handles 0 totalAssetsAll for percentage", () => {
    const units = [
      makeUnit({ availableDate: "2026-01-01", isAvailable: true, amount: 50 }),
    ];
    const result = buildAvailabilityDistribution(units, 0);
    expect(result[0]?.percentage).toBe(0);
    expect(result[0]?.amount).toBe(50);
  });
});

describe("buildStrategyChartData", () => {
  it("maps strategy allocation to chart data", () => {
    const input = [
      { strategy: "长期理财" as const, total_amount: 10000, percentage: 60 },
      { strategy: "短期理财" as const, total_amount: 5000, percentage: 30 },
    ];
    const result = buildStrategyChartData(input);
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("长期理财");
    expect(result[0]?.value).toBe(10000);
    expect(result[0]?.percentage).toBe(60);
    expect(result[1]?.name).toBe("短期理财");
  });

  it("handles empty allocation", () => {
    expect(buildStrategyChartData([])).toEqual([]);
  });
});
