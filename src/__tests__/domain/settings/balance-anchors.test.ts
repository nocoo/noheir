import { describe, expect, it } from "vitest";
import {
  calculateAnchorDifferences,
  calculateBalanceAtDate,
  getDifferenceLevel,
  groupAnchorsByAccount,
} from "@/domain/settings/balance-anchors";

describe("balance-anchors domain", () => {
  it("groups anchors by account and sorts desc", () => {
    const grouped = groupAnchorsByAccount([
      { accountName: "A", date: "2024-01-01", balance: 100 },
      { accountName: "A", date: "2024-02-01", balance: 200 },
    ]);
    expect(grouped["A"]?.[0]?.date).toBe("2024-02-01");
  });

  it("calculates balance and difference", () => {
    const result = calculateBalanceAtDate({
      account: "A",
      date: "2024-01-31",
      anchors: [{ accountName: "A", date: "2024-01-01", balance: 100 }],
      transactions: [{ account: "A", date: "2024-01-10", income: 50 }],
      inputBalance: 140,
    });
    expect(result.calculatedBalance).toBe(150);
    expect(result.balanceDifference).toBe(10);
  });

  it("calculates anchor differences", () => {
    const anchors = [
      { accountName: "A", date: "2024-01-01", balance: 100 },
      { accountName: "A", date: "2024-01-10", balance: 150 },
    ];
    const grouped = groupAnchorsByAccount(anchors);
    const diffs = calculateAnchorDifferences({
      anchorsByAccount: grouped,
      anchors,
      transactions: [{ account: "A", date: "2024-01-05", income: 50 }],
    });
    expect(diffs["A-2024-01-10"]).toBe(0);
  });

  it("maps difference level", () => {
    expect(getDifferenceLevel(null)).toBe(null);
    expect(getDifferenceLevel(0.5)).toBe("none");
    expect(getDifferenceLevel(50)).toBe("info");
    expect(getDifferenceLevel(500)).toBe("warning");
    expect(getDifferenceLevel(5000)).toBe("error");
  });
});
