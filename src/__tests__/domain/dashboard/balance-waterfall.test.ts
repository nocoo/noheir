import { describe, expect, it } from "vitest";
import { buildBalanceWaterfallData } from "@/domain/dashboard/balance-waterfall";

describe("balance-waterfall domain", () => {
  it("builds cumulative balances", () => {
    const data = [
      { month: "1月", income: 1000, expense: 400, balance: 600 },
      { month: "2月", income: 500, expense: 700, balance: -200 },
    ];
    const result = buildBalanceWaterfallData(data);
    expect(result.cumulativeBalance).toBe(400);
    expect(result.waterfallData[1]?.cumulative).toBe(400);
  });
});
