import { describe, expect, it } from "vitest";
import {
  clampReturnRate,
  clampMinReturnRate,
  clampMaxReturnRate,
  getReturnRateStatus,
  getReturnRateTextClass,
  getReturnRateBgClass,
  getReturnRateDescription,
  DEFAULT_MIN_RETURN_RATE,
  DEFAULT_MAX_RETURN_RATE,
} from "@/domain/settings/return-rate";

describe("return-rate domain", () => {
  describe("clampReturnRate", () => {
    it("clamps return rate", () => {
      expect(clampReturnRate(-1, 0, 10)).toBe(0);
      expect(clampReturnRate(20, 0, 10)).toBe(10);
      expect(clampReturnRate(5, 0, 10)).toBe(5);
    });

    it("handles non-finite values", () => {
      expect(clampReturnRate(Number.NaN, 0, 10)).toBe(0);
    });
  });

  describe("clampMinReturnRate", () => {
    it("clamps to valid range", () => {
      expect(clampMinReturnRate(-1)).toBe(0);
      expect(clampMinReturnRate(20)).toBe(10);
      expect(clampMinReturnRate(5)).toBe(5);
    });
  });

  describe("clampMaxReturnRate", () => {
    it("clamps to valid range", () => {
      expect(clampMaxReturnRate(-1)).toBe(0);
      expect(clampMaxReturnRate(20)).toBe(15);
      expect(clampMaxReturnRate(8)).toBe(8);
    });
  });

  describe("getReturnRateStatus", () => {
    it("returns 'low' when below min threshold", () => {
      expect(getReturnRateStatus(0.5, 1.0, 5.0)).toBe("low");
    });

    it("returns 'high' when above max threshold", () => {
      expect(getReturnRateStatus(8.0, 1.0, 5.0)).toBe("high");
    });

    it("returns 'normal' when within range", () => {
      expect(getReturnRateStatus(3.0, 1.0, 5.0)).toBe("normal");
    });

    it("returns 'normal' at exact boundaries", () => {
      expect(getReturnRateStatus(1.0, 1.0, 5.0)).toBe("normal");
      expect(getReturnRateStatus(5.0, 1.0, 5.0)).toBe("normal");
    });
  });

  describe("getReturnRateTextClass", () => {
    it("returns amber class for low", () => {
      expect(getReturnRateTextClass("low")).toContain("amber");
    });

    it("returns rose class for high", () => {
      expect(getReturnRateTextClass("high")).toContain("rose");
    });

    it("returns emerald class for normal", () => {
      expect(getReturnRateTextClass("normal")).toContain("emerald");
    });
  });

  describe("getReturnRateBgClass", () => {
    it("returns amber class for low", () => {
      expect(getReturnRateBgClass("low")).toContain("amber");
    });

    it("returns rose class for high", () => {
      expect(getReturnRateBgClass("high")).toContain("rose");
    });

    it("returns emerald class for normal", () => {
      expect(getReturnRateBgClass("normal")).toContain("emerald");
    });
  });

  describe("getReturnRateDescription", () => {
    it("returns description for each status", () => {
      expect(getReturnRateDescription("low")).toContain("偏低");
      expect(getReturnRateDescription("high")).toContain("风险");
      expect(getReturnRateDescription("normal")).toContain("正常");
    });
  });

  describe("constants", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_MIN_RETURN_RATE).toBe(1.25);
      expect(DEFAULT_MAX_RETURN_RATE).toBe(4.0);
      expect(DEFAULT_MIN_RETURN_RATE).toBeLessThan(DEFAULT_MAX_RETURN_RATE);
    });
  });
});
