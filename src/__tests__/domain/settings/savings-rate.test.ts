import { describe, expect, it } from "vitest";
import { clampSavingsRate, getSavingsRateTone } from "@/domain/settings/savings-rate";

describe("savings-rate settings domain", () => {
  it("clamps savings rate to 0-100 range", () => {
    expect(clampSavingsRate(-10)).toBe(0);
    expect(clampSavingsRate(150)).toBe(100);
    expect(clampSavingsRate(50)).toBe(50);
  });

  it("rounds to integer", () => {
    expect(clampSavingsRate(33.7)).toBe(34);
  });

  it("handles non-finite values", () => {
    expect(clampSavingsRate(Number.NaN)).toBe(0);
  });

  it("returns appropriate tone", () => {
    expect(getSavingsRateTone(80)).toBe("high");
    expect(getSavingsRateTone(50)).toBe("ok");
    expect(getSavingsRateTone(10)).toBe("low");
  });
});
