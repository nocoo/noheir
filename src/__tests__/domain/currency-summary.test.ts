import { describe, expect, it } from "vitest";
import { sumCurrency } from "@/domain/currency-summary";

describe("non-converted currency totals", () => {
  it("sums only CNY by default without hiding or mutating other records", () => {
    const rows = [
      { amount: 10, currency: "CNY" },
      { amount: 200, currency: "USD" },
      { amount: -2, currency: "CNY" },
    ];
    expect(sumCurrency(rows)).toBe(8);
    expect(sumCurrency(rows, "USD")).toBe(200);
    expect(sumCurrency(rows, "HKD")).toBe(0);
    expect(rows).toHaveLength(3);
  });
});
