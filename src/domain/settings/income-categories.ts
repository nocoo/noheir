/**
 * Income category classification domain logic.
 *
 * Categorizes income into:
 * - Active income: requires ongoing time/labor (salary, bonuses)
 * - Passive income: no ongoing effort required (investments, rent)
 */

/**
 * Toggle a category in the active income list.
 */
export function toggleActiveIncomeCategory(
  current: string[],
  category: string,
): string[] {
  const index = current.indexOf(category);
  if (index >= 0) {
    return current.filter((c) => c !== category);
  }
  return [...current, category];
}

/**
 * Check if a category is marked as active income.
 */
export function isActiveIncome(
  activeCategories: string[],
  category: string,
): boolean {
  return activeCategories.includes(category);
}

/**
 * Get the display label for income type.
 */
export function getIncomeTypeLabel(isActive: boolean): string {
  return isActive ? "主动收入" : "被动收入";
}

/**
 * Get the description for income types.
 */
export function getIncomeTypeDescription(isActive: boolean): string {
  return isActive
    ? "需要持续投入时间和劳动获得的收入（如工资、补贴）"
    : "无需持续劳动即可获得的收入（如投资收益、房租、理财）";
}

/**
 * Default categories commonly considered as active income.
 */
export const DEFAULT_ACTIVE_INCOME_HINTS = [
  "工资",
  "奖金",
  "补贴",
  "兼职",
  "劳务",
  "稿费",
  "咨询",
];
