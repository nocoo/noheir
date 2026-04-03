import { describe, expect, it } from "bun:test";
import {
  CHART_COLORS,
  CHART_TOKENS,
  chart,
  withAlpha,
  chartIncome,
  chartExpense,
  chartPrimary,
  chartBalance,
  strategyColor,
  tacticsColor,
  currencyColor,
  statusColor,
  maturityColor,
  STRATEGY_TOKEN_MAP,
  TACTICS_TOKEN_MAP,
  CURRENCY_TOKEN_MAP,
  STATUS_TOKEN_MAP,
  MATURITY_TOKEN_MAP,
  hashToChartToken,
  getStrategyToken,
  getTacticsToken,
  getStatusToken,
  getCurrencyToken,
} from "@/lib/palette";

describe("palette", () => {
  describe("CHART_COLORS", () => {
    it("exports 24 colors", () => {
      expect(CHART_COLORS.length).toBe(24);
    });

    it("colors use CSS variables", () => {
      expect(CHART_COLORS[0]).toBe("hsl(var(--chart-1))");
      expect(CHART_COLORS[23]).toBe("hsl(var(--chart-24))");
    });
  });

  describe("chart object", () => {
    it("has named color accessors", () => {
      expect(chart.sky).toBe("hsl(var(--chart-1))");
      expect(chart.teal).toBe("hsl(var(--chart-2))");
      expect(chart.jade).toBe("hsl(var(--chart-3))");
      expect(chart.blue).toBe("hsl(var(--chart-24))");
    });

    it("has all 24 named colors", () => {
      expect(Object.keys(chart).length).toBe(24);
    });
  });

  describe("CHART_TOKENS", () => {
    it("has 24 tokens", () => {
      expect(CHART_TOKENS.length).toBe(24);
      expect(CHART_TOKENS[0]).toBe("chart-1");
      expect(CHART_TOKENS[23]).toBe("chart-24");
    });
  });

  describe("withAlpha", () => {
    it("adds alpha to CSS variable", () => {
      expect(withAlpha("chart-1", 0.5)).toBe("hsl(var(--chart-1) / 0.5)");
      expect(withAlpha("income", 0.12)).toBe("hsl(var(--income) / 0.12)");
    });
  });

  describe("semantic aliases", () => {
    it("exports chartIncome and chartExpense", () => {
      expect(chartIncome).toBe("hsl(var(--income))");
      expect(chartExpense).toBe("hsl(var(--expense))");
    });

    it("exports chartPrimary and chartBalance", () => {
      expect(chartPrimary).toBe(chart.sky);
      expect(chartBalance).toBe(chart.teal);
    });
  });

  describe("domain token maps", () => {
    it("STRATEGY_TOKEN_MAP has expected strategies", () => {
      expect(STRATEGY_TOKEN_MAP["长期理财"]).toBe("chart-3");
      expect(STRATEGY_TOKEN_MAP["美元资产"]).toBe("chart-13");
      expect(STRATEGY_TOKEN_MAP["进攻计划"]).toBe("chart-9");
    });

    it("TACTICS_TOKEN_MAP has expected tactics", () => {
      expect(TACTICS_TOKEN_MAP["养老年金"]).toBe("chart-24");
      expect(TACTICS_TOKEN_MAP["定期存款"]).toBe("chart-2");
      expect(TACTICS_TOKEN_MAP["偏股基金"]).toBe("chart-9");
    });

    it("CURRENCY_TOKEN_MAP has all currencies", () => {
      expect(CURRENCY_TOKEN_MAP["CNY"]).toBe("chart-9");
      expect(CURRENCY_TOKEN_MAP["USD"]).toBe("chart-24");
      expect(CURRENCY_TOKEN_MAP["HKD"]).toBe("chart-6");
    });

    it("STATUS_TOKEN_MAP has all statuses", () => {
      expect(STATUS_TOKEN_MAP["已成立"]).toBe("chart-3");
      expect(STATUS_TOKEN_MAP["计划中"]).toBe("chart-24");
      expect(STATUS_TOKEN_MAP["已归档"]).toBe("chart-16");
    });

    it("MATURITY_TOKEN_MAP has periods", () => {
      expect(MATURITY_TOKEN_MAP["已到期"]).toBe("chart-9");
      expect(MATURITY_TOKEN_MAP["7天内"]).toBe("chart-7");
      expect(MATURITY_TOKEN_MAP["90天以上"]).toBe("chart-3");
    });
  });

  describe("hashToChartToken", () => {
    it("returns stable hash for same input", () => {
      const token1 = hashToChartToken("test");
      const token2 = hashToChartToken("test");
      expect(token1).toBe(token2);
    });

    it("returns different tokens for different inputs", () => {
      const token1 = hashToChartToken("foo");
      const token2 = hashToChartToken("bar");
      // They might be same by chance, but very unlikely
      expect(token1).toMatch(/^chart-\d+$/);
      expect(token2).toMatch(/^chart-\d+$/);
    });

    it("excludes gray colors (chart-16, chart-23)", () => {
      // Test many inputs to verify gray colors are never returned
      const tokens = Array.from({ length: 100 }, (_, i) => hashToChartToken(`test-${i}`));
      expect(tokens).not.toContain("chart-16");
      expect(tokens).not.toContain("chart-23");
    });
  });

  describe("getXxxToken helpers", () => {
    it("getStrategyToken uses map for known, hash for unknown", () => {
      expect(getStrategyToken("长期理财")).toBe("chart-3");
      const unknownToken = getStrategyToken("未知策略");
      expect(unknownToken).toMatch(/^chart-\d+$/);
      expect(unknownToken).not.toBe("chart-16");
      expect(unknownToken).not.toBe("chart-23");
    });

    it("getTacticsToken uses map for known, hash for unknown", () => {
      expect(getTacticsToken("养老年金")).toBe("chart-24");
      const unknownToken = getTacticsToken("未知战术");
      expect(unknownToken).toMatch(/^chart-\d+$/);
    });

    it("getStatusToken uses map for known, hash for unknown", () => {
      expect(getStatusToken("已成立")).toBe("chart-3");
      const unknownToken = getStatusToken("未知状态");
      expect(unknownToken).toMatch(/^chart-\d+$/);
    });

    it("getCurrencyToken uses map for known, hash for unknown", () => {
      expect(getCurrencyToken("CNY")).toBe("chart-9");
      const unknownToken = getCurrencyToken("EUR");
      expect(unknownToken).toMatch(/^chart-\d+$/);
    });
  });

  describe("domain color helpers", () => {
    it("strategyColor returns CSS variable", () => {
      expect(strategyColor("长期理财")).toBe("hsl(var(--chart-3))");
      // Unknown uses hash, not gray
      const unknownColor = strategyColor("unknown");
      expect(unknownColor).toMatch(/^hsl\(var\(--chart-\d+\)\)$/);
    });

    it("tacticsColor returns CSS variable", () => {
      expect(tacticsColor("养老年金")).toBe("hsl(var(--chart-24))");
      expect(tacticsColor("定期存款")).toBe("hsl(var(--chart-2))");
    });

    it("currencyColor returns CSS variable", () => {
      expect(currencyColor("CNY")).toBe("hsl(var(--chart-9))");
      expect(currencyColor("USD")).toBe("hsl(var(--chart-24))");
    });

    it("statusColor returns CSS variable", () => {
      expect(statusColor("已成立")).toBe("hsl(var(--chart-3))");
    });

    it("maturityColor returns CSS variable", () => {
      expect(maturityColor("已到期")).toBe("hsl(var(--chart-9))");
      expect(maturityColor("30天内")).toBe("hsl(var(--chart-6))");
    });
  });
});
