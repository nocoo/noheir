import { describe, expect, it } from "vitest";
import {
  buildSafeMonthlyData,
  buildSafeTotalIncome,
  buildFinancialHealthResult,
} from "@/domain/dashboard/financial-health";

describe("financial-health domain", () => {
  it("builds safe monthly data", () => {
    expect(buildSafeMonthlyData([])).toEqual([]);
  });

  it("builds safe total income", () => {
    expect(buildSafeTotalIncome(Number.NaN)).toBe(0);
  });

  it("builds health result", () => {
    const result = buildFinancialHealthResult([], [], 0, []);
    expect(result.maxScore).toBe(100);
  });
});
