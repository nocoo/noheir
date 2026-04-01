/**
 * Theme and color scheme domain logic.
 *
 * Handles:
 * - Theme mode: light / dark / system
 * - Color scheme: default (green income, red expense) / swapped (red income, green expense)
 */

import type { Theme, ColorScheme } from "@/domain/types";

// ── Theme validation ──

export const VALID_THEMES: Theme[] = ["light", "dark", "system"];
export const VALID_COLOR_SCHEMES: ColorScheme[] = ["default", "swapped"];

export function isValidTheme(value: unknown): value is Theme {
  return typeof value === "string" && VALID_THEMES.includes(value as Theme);
}

export function isValidColorScheme(value: unknown): value is ColorScheme {
  return typeof value === "string" && VALID_COLOR_SCHEMES.includes(value as ColorScheme);
}

export function normalizeTheme(value: unknown): Theme {
  return isValidTheme(value) ? value : "system";
}

export function normalizeColorScheme(value: unknown): ColorScheme {
  return isValidColorScheme(value) ? value : "default";
}

// ── Color scheme helpers ──

/**
 * Get the Tailwind class for income text color based on scheme.
 */
export function getIncomeTextClass(scheme: ColorScheme): string {
  return scheme === "swapped" ? "text-expense" : "text-income";
}

/**
 * Get the Tailwind class for expense text color based on scheme.
 */
export function getExpenseTextClass(scheme: ColorScheme): string {
  return scheme === "swapped" ? "text-income" : "text-expense";
}

/**
 * Get income color in HSL format for CSS style attributes.
 */
export function getIncomeColorHsl(scheme: ColorScheme): string {
  return scheme === "swapped" ? "hsl(var(--expense))" : "hsl(var(--income))";
}

/**
 * Get expense color in HSL format for CSS style attributes.
 */
export function getExpenseColorHsl(scheme: ColorScheme): string {
  return scheme === "swapped" ? "hsl(var(--income))" : "hsl(var(--expense))";
}

/**
 * Get income color in HEX format for chart libraries.
 */
export function getIncomeColorHex(scheme: ColorScheme): string {
  return scheme === "swapped" ? "#f43f5e" : "#10b981"; // rose-500 : emerald-500
}

/**
 * Get expense color in HEX format for chart libraries.
 */
export function getExpenseColorHex(scheme: ColorScheme): string {
  return scheme === "swapped" ? "#10b981" : "#f43f5e"; // emerald-500 : rose-500
}

// ── Theme labels for UI ──

export const THEME_OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

export const COLOR_SCHEME_OPTIONS: Array<{
  value: ColorScheme;
  label: string;
  description: string;
}> = [
  { value: "default", label: "默认", description: "收入为绿色，支出为红色" },
  { value: "swapped", label: "切换", description: "收入为红色，支出为绿色" },
];
