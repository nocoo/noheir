import { describe, expect, it } from "bun:test";
import {
  toggleActiveIncomeCategory,
  isActiveIncome,
  getIncomeTypeLabel,
  getIncomeTypeDescription,
  DEFAULT_ACTIVE_INCOME_HINTS,
} from "@/domain/settings/income-categories";

describe("income-categories domain", () => {
  describe("toggleActiveIncomeCategory", () => {
    it("adds category when not present", () => {
      const result = toggleActiveIncomeCategory([], "工资");
      expect(result).toEqual(["工资"]);
    });

    it("removes category when present", () => {
      const result = toggleActiveIncomeCategory(["工资", "奖金"], "工资");
      expect(result).toEqual(["奖金"]);
    });

    it("preserves other categories", () => {
      const result = toggleActiveIncomeCategory(["工资", "奖金", "补贴"], "奖金");
      expect(result).toEqual(["工资", "补贴"]);
    });
  });

  describe("isActiveIncome", () => {
    it("returns true when category is in list", () => {
      expect(isActiveIncome(["工资", "奖金"], "工资")).toBe(true);
    });

    it("returns false when category is not in list", () => {
      expect(isActiveIncome(["工资", "奖金"], "理财收益")).toBe(false);
    });

    it("returns false for empty list", () => {
      expect(isActiveIncome([], "工资")).toBe(false);
    });
  });

  describe("getIncomeTypeLabel", () => {
    it("returns correct label for active income", () => {
      expect(getIncomeTypeLabel(true)).toBe("主动收入");
    });

    it("returns correct label for passive income", () => {
      expect(getIncomeTypeLabel(false)).toBe("被动收入");
    });
  });

  describe("getIncomeTypeDescription", () => {
    it("returns description for active income", () => {
      const desc = getIncomeTypeDescription(true);
      expect(desc).toContain("时间");
      expect(desc).toContain("劳动");
    });

    it("returns description for passive income", () => {
      const desc = getIncomeTypeDescription(false);
      expect(desc).toContain("投资");
    });
  });

  describe("DEFAULT_ACTIVE_INCOME_HINTS", () => {
    it("contains common active income categories", () => {
      expect(DEFAULT_ACTIVE_INCOME_HINTS).toContain("工资");
      expect(DEFAULT_ACTIVE_INCOME_HINTS).toContain("奖金");
      expect(DEFAULT_ACTIVE_INCOME_HINTS.length).toBeGreaterThan(0);
    });
  });
});
