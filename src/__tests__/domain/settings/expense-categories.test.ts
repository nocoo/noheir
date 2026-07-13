import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIXED_EXPENSE_HINTS,
  getExpenseTypeDescription,
  getExpenseTypeLabel,
  isFixedExpense,
  toggleFixedExpenseCategory,
} from "@/domain/settings/expense-categories";

describe("expense-categories domain", () => {
  describe("toggleFixedExpenseCategory", () => {
    it("adds category when not present", () => {
      const result = toggleFixedExpenseCategory([], "房贷");
      expect(result).toEqual(["房贷"]);
    });

    it("removes category when present", () => {
      const result = toggleFixedExpenseCategory(["房贷", "保险"], "房贷");
      expect(result).toEqual(["保险"]);
    });

    it("preserves other categories", () => {
      const result = toggleFixedExpenseCategory(["房贷", "保险", "物业费"], "保险");
      expect(result).toEqual(["房贷", "物业费"]);
    });
  });

  describe("isFixedExpense", () => {
    it("returns true when category is in list", () => {
      expect(isFixedExpense(["房贷", "保险"], "房贷")).toBe(true);
    });

    it("returns false when category is not in list", () => {
      expect(isFixedExpense(["房贷", "保险"], "娱乐")).toBe(false);
    });

    it("returns false for empty list", () => {
      expect(isFixedExpense([], "房贷")).toBe(false);
    });
  });

  describe("getExpenseTypeLabel", () => {
    it("returns correct label for fixed expense", () => {
      expect(getExpenseTypeLabel(true)).toBe("固定支出");
    });

    it("returns correct label for flexible expense", () => {
      expect(getExpenseTypeLabel(false)).toBe("弹性支出");
    });
  });

  describe("getExpenseTypeDescription", () => {
    it("returns description for fixed expense", () => {
      const desc = getExpenseTypeDescription(true);
      expect(desc).toContain("必须");
      expect(desc).toContain("房贷");
    });

    it("returns description for flexible expense", () => {
      const desc = getExpenseTypeDescription(false);
      expect(desc).toContain("控制");
    });
  });

  describe("DEFAULT_FIXED_EXPENSE_HINTS", () => {
    it("contains common fixed expense categories", () => {
      expect(DEFAULT_FIXED_EXPENSE_HINTS).toContain("房贷");
      expect(DEFAULT_FIXED_EXPENSE_HINTS).toContain("保险");
      expect(DEFAULT_FIXED_EXPENSE_HINTS.length).toBeGreaterThan(0);
    });
  });
});
