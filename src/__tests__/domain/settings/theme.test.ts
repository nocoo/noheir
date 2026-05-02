import { describe, expect, it } from "vitest";
import {
  VALID_THEMES,
  VALID_COLOR_SCHEMES,
  isValidTheme,
  isValidColorScheme,
  normalizeTheme,
  normalizeColorScheme,
  getIncomeTextClass,
  getExpenseTextClass,
  getIncomeColorHsl,
  getExpenseColorHsl,
  getIncomeColorHex,
  getExpenseColorHex,
  THEME_OPTIONS,
  COLOR_SCHEME_OPTIONS,
} from "@/domain/settings/theme";

describe("theme domain", () => {
  describe("isValidTheme", () => {
    it("returns true for valid themes", () => {
      expect(isValidTheme("light")).toBe(true);
      expect(isValidTheme("dark")).toBe(true);
      expect(isValidTheme("system")).toBe(true);
    });

    it("returns false for invalid themes", () => {
      expect(isValidTheme("invalid")).toBe(false);
      expect(isValidTheme("")).toBe(false);
      expect(isValidTheme(null)).toBe(false);
      expect(isValidTheme(undefined)).toBe(false);
      expect(isValidTheme(123)).toBe(false);
    });
  });

  describe("isValidColorScheme", () => {
    it("returns true for valid color schemes", () => {
      expect(isValidColorScheme("default")).toBe(true);
      expect(isValidColorScheme("swapped")).toBe(true);
    });

    it("returns false for invalid color schemes", () => {
      expect(isValidColorScheme("invalid")).toBe(false);
      expect(isValidColorScheme("")).toBe(false);
      expect(isValidColorScheme(null)).toBe(false);
    });
  });

  describe("normalizeTheme", () => {
    it("returns valid theme as-is", () => {
      expect(normalizeTheme("light")).toBe("light");
      expect(normalizeTheme("dark")).toBe("dark");
      expect(normalizeTheme("system")).toBe("system");
    });

    it("returns 'system' for invalid values", () => {
      expect(normalizeTheme("invalid")).toBe("system");
      expect(normalizeTheme(null)).toBe("system");
      expect(normalizeTheme(undefined)).toBe("system");
    });
  });

  describe("normalizeColorScheme", () => {
    it("returns valid scheme as-is", () => {
      expect(normalizeColorScheme("default")).toBe("default");
      expect(normalizeColorScheme("swapped")).toBe("swapped");
    });

    it("returns 'default' for invalid values", () => {
      expect(normalizeColorScheme("invalid")).toBe("default");
      expect(normalizeColorScheme(null)).toBe("default");
    });
  });

  describe("color helpers", () => {
    it("getIncomeTextClass returns correct classes", () => {
      expect(getIncomeTextClass("default")).toBe("text-income");
      expect(getIncomeTextClass("swapped")).toBe("text-expense");
    });

    it("getExpenseTextClass returns correct classes", () => {
      expect(getExpenseTextClass("default")).toBe("text-expense");
      expect(getExpenseTextClass("swapped")).toBe("text-income");
    });

    it("getIncomeColorHsl returns HSL values", () => {
      expect(getIncomeColorHsl("default")).toBe("hsl(var(--income))");
      expect(getIncomeColorHsl("swapped")).toBe("hsl(var(--expense))");
    });

    it("getExpenseColorHsl returns HSL values", () => {
      expect(getExpenseColorHsl("default")).toBe("hsl(var(--expense))");
      expect(getExpenseColorHsl("swapped")).toBe("hsl(var(--income))");
    });

    it("getIncomeColorHex returns hex values", () => {
      expect(getIncomeColorHex("default")).toBe("#10b981");
      expect(getIncomeColorHex("swapped")).toBe("#f43f5e");
    });

    it("getExpenseColorHex returns hex values", () => {
      expect(getExpenseColorHex("default")).toBe("#f43f5e");
      expect(getExpenseColorHex("swapped")).toBe("#10b981");
    });
  });

  describe("constants", () => {
    it("VALID_THEMES contains expected values", () => {
      expect(VALID_THEMES).toContain("light");
      expect(VALID_THEMES).toContain("dark");
      expect(VALID_THEMES).toContain("system");
      expect(VALID_THEMES.length).toBe(3);
    });

    it("VALID_COLOR_SCHEMES contains expected values", () => {
      expect(VALID_COLOR_SCHEMES).toContain("default");
      expect(VALID_COLOR_SCHEMES).toContain("swapped");
      expect(VALID_COLOR_SCHEMES.length).toBe(2);
    });

    it("THEME_OPTIONS has correct structure", () => {
      expect(THEME_OPTIONS.length).toBe(3);
      expect(THEME_OPTIONS[0]).toEqual({ value: "light", label: "浅色" });
    });

    it("COLOR_SCHEME_OPTIONS has correct structure", () => {
      expect(COLOR_SCHEME_OPTIONS.length).toBe(2);
      expect(COLOR_SCHEME_OPTIONS[0]).toHaveProperty("value", "default");
      expect(COLOR_SCHEME_OPTIONS[0]).toHaveProperty("label");
      expect(COLOR_SCHEME_OPTIONS[0]).toHaveProperty("description");
    });
  });
});
