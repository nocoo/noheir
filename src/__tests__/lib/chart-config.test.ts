import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatCurrencyFull,
  formatCurrencyK,
  formatDate,
  getChartMargin,
  yAxisWidth,
} from "@/lib/chart-config";

describe("chart-config", () => {
  it("formats currency with yen symbol", () => {
    expect(formatCurrency(1234.5)).toContain("¥");
    expect(formatCurrency(1234.5)).toContain("1,234.50");
  });

  it("formatCurrencyFull matches formatCurrency", () => {
    expect(formatCurrencyFull(100)).toBe(formatCurrency(100));
  });

  it("formats currency in K units", () => {
    expect(formatCurrencyK(5000)).toBe("¥5.00k");
  });

  it("formats date in zh-CN locale", () => {
    const result = formatDate("2024-06-15");
    expect(result).toContain("2024");
  });

  it("returns chart margins for different sizes", () => {
    const small = getChartMargin("small");
    const medium = getChartMargin("medium");
    expect(small.top).toBeLessThan(medium.top);
  });

  it("exports yAxisWidth", () => {
    expect(yAxisWidth).toBe(100);
  });
});
