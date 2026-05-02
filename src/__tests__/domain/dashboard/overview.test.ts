import { describe, expect, it } from "vitest";
import { buildSavingsRate } from "@/domain/dashboard/overview";

describe("overview domain", () => {
  it("returns zero when income is zero", () => {
    expect(buildSavingsRate(0, 100)).toBe(0);
  });

  it("calculates savings rate", () => {
    expect(buildSavingsRate(1000, 200)).toBeCloseTo(80);
  });
});
