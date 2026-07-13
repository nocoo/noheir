/**
 * Expense category classification domain logic.
 *
 * Categorizes expenses into:
 * - Fixed expenses: mandatory monthly payments (mortgage, insurance)
 * - Flexible expenses: discretionary spending (entertainment, shopping)
 */

/**
 * Toggle a category in the fixed expense list.
 */
export function toggleFixedExpenseCategory(current: string[], category: string): string[] {
  const index = current.indexOf(category);
  if (index >= 0) {
    return current.filter((c) => c !== category);
  }
  return [...current, category];
}

/**
 * Check if a category is marked as fixed expense.
 */
export function isFixedExpense(fixedCategories: string[], category: string): boolean {
  return fixedCategories.includes(category);
}

/**
 * Get the display label for expense type.
 */
export function getExpenseTypeLabel(isFixed: boolean): string {
  return isFixed ? "固定支出" : "弹性支出";
}

/**
 * Get the description for expense types.
 */
export function getExpenseTypeDescription(isFixed: boolean): string {
  return isFixed
    ? "每个月必须支付的刚性支出（如房贷房租、保险、物业费等）"
    : "可以控制或延后的非必要支出（如娱乐、购物等）";
}

/**
 * Default categories commonly considered as fixed expenses.
 */
export const DEFAULT_FIXED_EXPENSE_HINTS = [
  "房贷",
  "房租",
  "保险",
  "物业费",
  "水电费",
  "通信费",
  "车贷",
  "学费",
];
