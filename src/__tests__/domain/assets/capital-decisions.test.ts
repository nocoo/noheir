import { describe, expect, it } from "vitest";
import type { UnitDisplayInfo, DomainProduct } from "@/domain/types";
import {
  classifyDecisions,
  buildDecisionStats,
  buildFilterCounts,
  buildCurrencyTooltip,
  sortDecisions,
} from "@/domain/assets/capital-decisions";

const makeProduct = (
  overrides: Partial<DomainProduct> = {},
): DomainProduct => ({
  id: "p1",
  name: "招行季季宝",
  code: null,
  channel: null,
  category: "固定收益",
  currency: null,
  lockPeriodDays: 90,
  openDays: null,
  cycleDays: null,
  annualReturnRate: 0.03,
  isArchived: false,
  ...overrides,
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
  productId: null,
  startDate: "2024-01-01",
  endDate: null,
  note: null,
  availableDate: "2024-06-01",
  isAvailable: false,
  daysUntilAvailable: null,
  daysUntilLocked: null,
  latestInvestDate: null,
  ...overrides,
});

describe("capital-decisions domain", () => {
  describe("classifyDecisions", () => {
    it("classifies 计划中 unit as low urgency", () => {
      const decisions = classifyDecisions([makeUnit({ status: "计划中" })]);
      expect(decisions[0]?.urgency).toBe("low");
      expect(decisions[0]?.reason).toBe("待成立");
    });

    it("classifies idle unit (no product) as high urgency", () => {
      const decisions = classifyDecisions([makeUnit()]);
      expect(decisions[0]?.urgency).toBe("high");
      expect(decisions[0]?.reason).toBe("待投放");
    });

    it("classifies 现金+ product as medium urgency", () => {
      const decisions = classifyDecisions([
        makeUnit({ product: makeProduct({ category: "现金+" }) }),
      ]);
      expect(decisions[0]?.urgency).toBe("medium");
      expect(decisions[0]?.reason).toBe("待再配置");
    });

    it("classifies recently unlocked unit", () => {
      const decisions = classifyDecisions([
        makeUnit({
          product: makeProduct(),
          isAvailable: true,
          daysUntilAvailable: -10,
        }),
      ]);
      expect(decisions[0]?.urgency).toBe("medium");
      expect(decisions[0]?.reason).toBe("刚解锁");
    });

    it("classifies long-unlocked unit as low urgency", () => {
      const decisions = classifyDecisions([
        makeUnit({
          product: makeProduct(),
          isAvailable: true,
          daysUntilAvailable: -60,
        }),
      ]);
      expect(decisions[0]?.urgency).toBe("low");
      expect(decisions[0]?.reason).toBe("已可用");
    });

    it("classifies unit unlocking today as high urgency", () => {
      const decisions = classifyDecisions([
        makeUnit({
          product: makeProduct(),
          daysUntilAvailable: 0,
        }),
      ]);
      expect(decisions[0]?.urgency).toBe("high");
      expect(decisions[0]?.reason).toBe("即将解锁");
      expect(decisions[0]?.details).toContain("今日");
    });

    it("classifies unit unlocking tomorrow", () => {
      const decisions = classifyDecisions([
        makeUnit({
          product: makeProduct(),
          daysUntilAvailable: 1,
        }),
      ]);
      expect(decisions[0]?.details).toContain("明日");
    });

    it("classifies unit unlocking in 5 days", () => {
      const decisions = classifyDecisions([
        makeUnit({
          product: makeProduct(),
          daysUntilAvailable: 5,
        }),
      ]);
      expect(decisions[0]?.urgency).toBe("high");
      expect(decisions[0]?.details).toContain("5天后");
    });

    it("classifies unit unlocking in 20 days as medium", () => {
      const decisions = classifyDecisions([
        makeUnit({
          product: makeProduct(),
          daysUntilAvailable: 20,
        }),
      ]);
      expect(decisions[0]?.urgency).toBe("medium");
      expect(decisions[0]?.reason).toBe("即将解锁");
    });

    it("skips non-已成立 non-计划中 units", () => {
      const decisions = classifyDecisions([
        makeUnit({ status: "已归档" }),
      ]);
      expect(decisions.length).toBe(0);
    });

    it("sorts by urgency then unit code", () => {
      const decisions = classifyDecisions([
        makeUnit({ unitCode: "B01", status: "计划中" }), // low
        makeUnit({ id: "2", unitCode: "A01" }), // high (no product)
      ]);
      expect(decisions[0]?.urgency).toBe("high");
      expect(decisions[1]?.urgency).toBe("low");
    });
  });

  describe("buildDecisionStats", () => {
    it("aggregates stats by urgency", () => {
      const decisions = classifyDecisions([
        makeUnit({ unitCode: "A01", amount: 1000 }),
        makeUnit({ id: "2", unitCode: "B01", status: "计划中", amount: 500 }),
      ]);
      const stats = buildDecisionStats(decisions);
      expect(stats.total).toBe(2);
      expect(stats.high).toBe(1);
      expect(stats.low).toBe(1);
      expect(stats.totalAmount).toBe(1500);
      expect(stats.highAmount).toBe(1000);
      expect(stats.lowAmount).toBe(500);
    });

    it("returns zero amounts when no decisions", () => {
      const stats = buildDecisionStats([]);
      expect(stats.total).toBe(0);
      expect(stats.totalAmount).toBe(0);
      expect(stats.highAmount).toBe(0);
      expect(stats.mediumAmount).toBe(0);
      expect(stats.lowAmount).toBe(0);
    });

    it("calculates medium amount separately", () => {
      const decisions = classifyDecisions([
        makeUnit({
          unitCode: "A01",
          amount: 2000,
          product: makeProduct({ category: "现金+" }),
        }),
      ]);
      const stats = buildDecisionStats(decisions);
      expect(stats.medium).toBe(1);
      expect(stats.mediumAmount).toBe(2000);
    });
  });

  describe("buildFilterCounts", () => {
    it("counts by urgency level", () => {
      const decisions = classifyDecisions([
        makeUnit({ unitCode: "A01" }),
        makeUnit({ id: "2", unitCode: "B01", status: "计划中" }),
      ]);
      const counts = buildFilterCounts(decisions);
      expect(counts.all).toBe(2);
    });
  });

  describe("buildCurrencyTooltip", () => {
    it("formats CNY", () => {
      expect(buildCurrencyTooltip("CNY", 1234.56)).toContain("¥");
    });
    it("formats USD", () => {
      expect(buildCurrencyTooltip("USD", 100)).toContain("$");
    });
    it("formats HKD", () => {
      expect(buildCurrencyTooltip("HKD", 100)).toContain("HK$");
    });
  });

  describe("sortDecisions", () => {
    it("returns unsorted when no column", () => {
      const items = [
        { urgency: "low" as const, reason: "x", unit: makeUnit(), details: "b" },
      ];
      expect(sortDecisions(items, null, null)).toBe(items);
    });

    it("sorts by 番号", () => {
      const items = [
        { urgency: "low" as const, reason: "x", unit: makeUnit({ unitCode: "B01" }), details: "b" },
        { urgency: "low" as const, reason: "x", unit: makeUnit({ unitCode: "A01" }), details: "a" },
      ];
      const sorted = sortDecisions(items, "番号", "asc");
      expect(sorted[0]?.unit.unitCode).toBe("A01");
    });

    it("sorts by 策略", () => {
      const items = [
        { urgency: "low" as const, reason: "x", unit: makeUnit({ strategy: "长期理财" }), details: "b" },
        { urgency: "low" as const, reason: "x", unit: makeUnit({ strategy: "短期理财" }), details: "a" },
      ];
      const sorted = sortDecisions(items, "策略", "asc");
      expect(sorted.length).toBe(2);
    });

    it("sorts by 说明", () => {
      const items = [
        { urgency: "low" as const, reason: "x", unit: makeUnit(), details: "zzz" },
        { urgency: "low" as const, reason: "x", unit: makeUnit(), details: "aaa" },
      ];
      const sorted = sortDecisions(items, "说明", "asc");
      expect(sorted[0]?.details).toBe("aaa");
    });
  });
});
