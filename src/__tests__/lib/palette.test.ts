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
  currencyColor,
  statusColor,
  maturityColor,
  STRATEGY_TOKEN_MAP,
  CURRENCY_TOKEN_MAP,
  STATUS_TOKEN_MAP,
  MATURITY_TOKEN_MAP,
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

    it("CURRENCY_TOKEN_MAP has all currencies", () => {
      expect(CURRENCY_TOKEN_MAP["CNY"]).toBe("chart-9");
      expect(CURRENCY_TOKEN_MAP["USD"]).toBe("chart-24");
      expect(CURRENCY_TOKEN_MAP["HKD"]).toBe("chart-6");
    });

    it("STATUS_TOKEN_MAP has all statuses", () => {
      expect(STATUS_TOKEN_MAP["已成立"]).toBe("chart-3");
      expect(STATUS_TOKEN_MAP["计划中"]).toBe("chart-23");
      expect(STATUS_TOKEN_MAP["已归档"]).toBe("chart-16");
    });

    it("MATURITY_TOKEN_MAP has periods", () => {
      expect(MATURITY_TOKEN_MAP["已到期"]).toBe("chart-9");
      expect(MATURITY_TOKEN_MAP["7天内"]).toBe("chart-7");
      expect(MATURITY_TOKEN_MAP["90天以上"]).toBe("chart-3");
    });
  });

  describe("domain color helpers", () => {
    it("strategyColor returns CSS variable", () => {
      expect(strategyColor("长期理财")).toBe("hsl(var(--chart-3))");
      expect(strategyColor("unknown")).toBe("hsl(var(--chart-23))"); // fallback
    });

    it("currencyColor returns CSS variable", () => {
      expect(currencyColor("CNY")).toBe("hsl(var(--chart-9))");
      expect(currencyColor("USD")).toBe("hsl(var(--chart-24))");
      expect(currencyColor("EUR")).toBe("hsl(var(--chart-23))"); // fallback
    });

    it("statusColor returns CSS variable", () => {
      expect(statusColor("已成立")).toBe("hsl(var(--chart-3))");
      expect(statusColor("unknown")).toBe("hsl(var(--chart-23))"); // fallback
    });

    it("maturityColor returns CSS variable", () => {
      expect(maturityColor("已到期")).toBe("hsl(var(--chart-9))");
      expect(maturityColor("30天内")).toBe("hsl(var(--chart-6))");
      expect(maturityColor("unknown")).toBe("hsl(var(--chart-23))"); // fallback
    });
  });
});
