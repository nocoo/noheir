import { describe, expect, it } from "bun:test";
import type { UnitDisplayInfo, DomainProduct } from "@/domain/types";
import {
  buildMonthlyMaturities,
  buildSeries,
  buildSummaryStats,
} from "@/domain/assets/liquidity-ladder";
import { format, addMonths, startOfMonth } from "date-fns";

const makeProduct = (): DomainProduct => ({
  id: "p1",
  name: "招行季季宝",
  code: null,
  channel: null,
  category: "固定收益",
  currency: null,
  lockPeriodDays: 90,
  annualReturnRate: 0.03,
});

const makeUnit = (
  overrides: Partial<UnitDisplayInfo> = {},
): UnitDisplayInfo => ({
  id: "1",
  unitCode: "A01",
  amount: 10000,
  currency: "CNY",
  status: "已成立",
  strategy: "长期理财",
  tactics: "稳健理财",
  productId: "p1",
  startDate: "2024-01-01",
  endDate: null,
  note: null,
  product: makeProduct(),
  ...overrides,
});

describe("liquidity-ladder domain", () => {
  it("builds empty data when no units", () => {
    const data = buildMonthlyMaturities([]);
    expect(data.months.length).toBe(0);
    expect(data.strategies.length).toBe(0);
    expect(data.monthlyMaturities.length).toBe(0);
  });

  it("builds maturities from units with end dates", () => {
    // Create a unit maturing 3 months from now
    const futureDate = format(
      startOfMonth(addMonths(new Date(), 3)),
      "yyyy-MM-dd",
    );
    const units = [
      makeUnit({ endDate: futureDate, strategy: "长期理财" }),
      makeUnit({
        id: "2",
        unitCode: "A02",
        endDate: futureDate,
        strategy: "短期理财",
        amount: 5000,
      }),
    ];
    const data = buildMonthlyMaturities(units);
    expect(data.strategies.length).toBe(2);
    expect(data.months.length).toBe(24);
    expect(data.monthlyMaturities.length).toBeGreaterThan(0);
  });

  it("filters out units without end_date or product", () => {
    const futureDate = format(
      startOfMonth(addMonths(new Date(), 2)),
      "yyyy-MM-dd",
    );
    const units = [
      makeUnit({ endDate: null }), // no end_date
      makeUnit({ id: "2", endDate: futureDate, product: null }), // no product
      makeUnit({ id: "3", endDate: futureDate }), // valid
    ];
    const data = buildMonthlyMaturities(units);
    // Only the valid unit should contribute
    const totalAmount = data.monthlyMaturities
      .filter((m) => m.amount > 0)
      .reduce((sum, m) => sum + m.amount, 0);
    expect(totalAmount).toBe(10000);
  });

  it("ignores past maturities", () => {
    const units = [
      makeUnit({ endDate: "2020-01-01" }), // past
    ];
    const data = buildMonthlyMaturities(units);
    const totalAmount = data.monthlyMaturities
      .filter((m) => m.amount > 0)
      .reduce((sum, m) => sum + m.amount, 0);
    expect(totalAmount).toBe(0);
  });

  it("builds series from monthly data", () => {
    const data = {
      monthlyMaturities: [
        { month: "2024-01", monthLabel: "2024年1月", strategy: "A", amount: 10 },
        { month: "2024-02", monthLabel: "2024年2月", strategy: "A", amount: 20 },
      ],
      months: ["2024-01", "2024-02"],
      strategies: ["A"],
    };
    const series = buildSeries(data);
    expect(series.length).toBe(1);
    expect(series[0]?.data).toEqual([10, 20]);
  });

  it("builds summary stats", () => {
    const data = {
      monthlyMaturities: [
        { month: "2024-01", monthLabel: "2024年1月", strategy: "A", amount: 10 },
        { month: "2024-02", monthLabel: "2024年2月", strategy: "A", amount: 50 },
      ],
      months: ["2024-01", "2024-02"],
      strategies: ["A"],
    };
    const summary = buildSummaryStats(data);
    expect(summary.total).toBe(60);
    expect(summary.peakMonth.month).toBe("2024-02");
    expect(summary.peakMonth.amount).toBe(50);
  });
});
