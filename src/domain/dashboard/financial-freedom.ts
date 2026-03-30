import type { DomainTransaction } from "../types";

export interface IncomeBreakdownResult {
  totalIncome: number;
  activeIncome: number;
  passiveIncome: number;
  activeByCategory: Map<string, number>;
  passiveByCategory: Map<string, number>;
}

export interface ScenarioResult {
  targetValue: number;
  currentValue: number;
  gap: number;
  percentage: number;
  isAchieved: boolean;
}

export interface FinancialFreedomSummary {
  totalExpense: number;
  isFree: boolean;
  freedomGap: number;
  freedomRatio: number;
  requiredExpenseReduction: number;
  requiredPassiveIncrease: number;
}

export const buildIncomeBreakdown = (
  transactions: DomainTransaction[],
  activeIncomeCategories: string[],
): IncomeBreakdownResult => {
  let totalIncome = 0;
  let activeIncome = 0;
  let passiveIncome = 0;

  const activeByCategory = new Map<string, number>();
  const passiveByCategory = new Map<string, number>();

  transactions
    .filter((t) => t.type === "income")
    .forEach((t) => {
      totalIncome += t.amount;
      const isActive = activeIncomeCategories.includes(t.tertiaryCategory);

      if (isActive) {
        activeIncome += t.amount;
        const key = t.secondaryCategory ?? t.tertiaryCategory;
        activeByCategory.set(key, (activeByCategory.get(key) ?? 0) + t.amount);
      } else {
        passiveIncome += t.amount;
        const key = t.secondaryCategory ?? t.tertiaryCategory;
        passiveByCategory.set(
          key,
          (passiveByCategory.get(key) ?? 0) + t.amount,
        );
      }
    });

  return {
    totalIncome,
    activeIncome,
    passiveIncome,
    activeByCategory,
    passiveByCategory,
  };
};

export const buildTotalExpense = (transactions: DomainTransaction[]) => {
  return transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
};

export const buildFreedomSummary = (
  totalExpense: number,
  passiveIncome: number,
): FinancialFreedomSummary => {
  const isFree = passiveIncome >= totalExpense;
  const freedomGap = totalExpense - passiveIncome;
  const freedomRatio =
    totalExpense > 0 ? (passiveIncome / totalExpense) * 100 : 0;
  const requiredExpenseReduction =
    totalExpense > 0
      ? ((totalExpense - passiveIncome) / totalExpense) * 100
      : 0;
  const requiredPassiveIncrease =
    passiveIncome > 0
      ? ((totalExpense - passiveIncome) / passiveIncome) * 100
      : 0;

  return {
    totalExpense,
    isFree,
    freedomGap,
    freedomRatio,
    requiredExpenseReduction,
    requiredPassiveIncrease,
  };
};

export const buildReduceExpenseScenario = (
  totalExpense: number,
  passiveIncome: number,
  reductionPercent: number,
): ScenarioResult => {
  const currentValue = totalExpense * (1 - reductionPercent / 100);
  return {
    targetValue: passiveIncome,
    currentValue,
    gap: currentValue - passiveIncome,
    percentage: totalExpense > 0 ? (passiveIncome / currentValue) * 100 : 0,
    isAchieved: passiveIncome >= currentValue,
  };
};

export const buildIncreaseIncomeScenario = (
  totalExpense: number,
  passiveIncome: number,
  increasePercent: number,
): ScenarioResult => {
  const targetValue = passiveIncome * (1 + increasePercent / 100);
  return {
    targetValue,
    currentValue: totalExpense,
    gap: totalExpense - targetValue,
    percentage: totalExpense > 0 ? (targetValue / totalExpense) * 100 : 0,
    isAchieved: targetValue >= totalExpense,
  };
};
