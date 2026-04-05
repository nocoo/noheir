import { describe, expect, it } from "bun:test";
import {
  buildCurrencyDistribution,
  buildDeploymentRate,
  buildIdleUnits,
  buildIncomingLiquidity,
  buildAvailabilityDistribution,
  buildStatusDistribution,
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
});
