import { describe, expect, it } from "vitest";
import { financialPreferencesSchema } from "@/domain/api-contract";

describe("financialPreferencesSchema", () => {
  it("defines the same defaults for an empty configuration and a reset", () => {
    expect(financialPreferencesSchema.parse({})).toEqual({
      savingsRateTarget: 30,
      expectedReturnRate: 4,
      minReturnRate: 2,
      maxReturnRate: 8,
      activeIncomeCategories: [],
      fixedExpenseCategories: [],
    });
  });

  it.each([
    [-100, 100],
    [-10, -5],
    [0, 0],
    [100, 100],
  ])("accepts an ordered return-rate interval of %s to %s", (minReturnRate, maxReturnRate) => {
    expect(financialPreferencesSchema.parse({ minReturnRate, maxReturnRate })).toMatchObject({
      minReturnRate,
      maxReturnRate,
    });
  });

  it.each([
    { minReturnRate: 9, maxReturnRate: 8 },
    { minReturnRate: -4, maxReturnRate: -5 },
    { minReturnRate: 9 },
    { maxReturnRate: 1 },
  ])("rejects an inverted interval including conflicts with defaults: %j", (input) => {
    const result = financialPreferencesSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ message: "Invalid return-rate interval" }),
      );
    }
  });

  it("trims category names while preserving financial settings", () => {
    expect(
      financialPreferencesSchema.parse({
        savingsRateTarget: 100,
        expectedReturnRate: -2.5,
        activeIncomeCategories: [" Salary "],
        fixedExpenseCategories: [" Housing "],
      }),
    ).toMatchObject({
      savingsRateTarget: 100,
      expectedReturnRate: -2.5,
      activeIncomeCategories: ["Salary"],
      fixedExpenseCategories: ["Housing"],
    });
  });

  it.each([
    { savingsRateTarget: -1 },
    { savingsRateTarget: 101 },
    { expectedReturnRate: 101 },
    { minReturnRate: -101 },
    { maxReturnRate: 101 },
    { activeIncomeCategories: [" "] },
    { fixedExpenseCategories: [""] },
    { activeIncomeCategories: null },
    { ownerId: "another-owner" },
    { version: 2 },
    { siteName: "Not financial data" },
  ])("rejects invalid values or non-financial fields: %j", (input) => {
    expect(financialPreferencesSchema.safeParse(input).success).toBe(false);
  });
});
