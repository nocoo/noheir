/**
 * Financial Health Core - 5-Dimensional Assessment Algorithm
 *
 * Dimensions:
 *   1. Growth    (20%) — Income/expense trend divergence (scissors analysis)
 *   2. Rigidity  (25%) — Fixed-expense ratio
 *   3. Quality   (15%) — Income diversification (HHI)
 *   4. Resilience (20%) — Cash-flow volatility & negative months
 *   5. Savings   (20%) — Weighted savings rate
 */

import type { DomainTransaction, MonthlyData } from "@/domain/types";

// ── Utility Functions ──

function linearRegression(data: number[]): {
  slope: number;
  intercept: number;
} {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0 };

  const xValues = Array.from({ length: n }, (_, i) => i);
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = data.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * (data[i] ?? 0), 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope: Number.isNaN(slope) ? 0 : slope, intercept };
}

function coefficientOfVariation(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + (val - mean) ** 2, 0) / data.length;
  const stdDev = Math.sqrt(variance);
  return mean === 0 ? 0 : stdDev / mean;
}

function calculateHHI(incomeBySource: Map<string, number>, totalIncome: number): number {
  if (totalIncome === 0) return 1;
  let hhi = 0;
  for (const amount of incomeBySource.values()) {
    const share = amount / totalIncome;
    hhi += share * share;
  }
  return hhi;
}

// ── Dimension Result Types ──

interface GrowthScoreResult {
  score: number;
  maxScore: 20;
  details: {
    incomeSlope: number;
    expenseSlope: number;
    trendDifference: number;
    interpretation: string;
  };
}

interface RigidityScoreResult {
  score: number;
  maxScore: 25;
  details: {
    fixedExpenseRatio: number;
    fixedExpenseAmount: number;
    totalIncome: number;
    interpretation: string;
  };
}

interface QualityScoreResult {
  score: number;
  maxScore: 15;
  details: {
    hhi: number;
    incomeSourceCount: number;
    interpretation: string;
  };
}

interface ResilienceScoreResult {
  score: number;
  maxScore: 20;
  details: {
    negativeCashflowMonths: number;
    totalMonths: number;
    cashflowCV: number;
    interpretation: string;
  };
}

interface SavingsScoreResult {
  score: number;
  maxScore: 20;
  details: {
    weightedSavingsRate: number;
    interpretation: string;
  };
}

// ── Dimension 1: Growth (20%) ──

function calculateGrowthScore(
  monthlyData: Pick<MonthlyData, "income" | "expense">[],
): GrowthScoreResult {
  if (monthlyData.length < 6) {
    return {
      score: 10,
      maxScore: 20,
      details: {
        incomeSlope: 0,
        expenseSlope: 0,
        trendDifference: 0,
        interpretation: "数据不足（需至少6个月）",
      },
    };
  }

  const last12 = monthlyData.slice(-12);
  const incomeRegression = linearRegression(last12.map((d) => d.income));
  const expenseRegression = linearRegression(last12.map((d) => d.expense));

  const incomeSlope = incomeRegression.slope;
  const expenseSlope = expenseRegression.slope;
  const trendDiff = incomeSlope - expenseSlope;

  let score = 10;
  if (trendDiff > 0) {
    score = 20;
  } else if (trendDiff > -expenseSlope * 0.1) {
    score = 15;
  } else if (trendDiff > -expenseSlope * 0.3) {
    score = 10;
  } else {
    score = 5;
  }

  return {
    score,
    maxScore: 20,
    details: {
      incomeSlope,
      expenseSlope,
      trendDifference: trendDiff,
      interpretation: trendDiff > 0 ? "收入增长跑赢支出" : "支出增长快于收入",
    },
  };
}

// ── Dimension 2: Rigidity (25%) ──

function calculateRigidityScore(
  transactions: DomainTransaction[] | undefined,
  totalIncome: number,
  fixedExpenseCategories: string[] = [],
): RigidityScoreResult {
  let fixedExpenses = 0;
  const safeTransactions = transactions ?? [];
  const fixedCategoriesSet = new Set(fixedExpenseCategories);

  for (const t of safeTransactions) {
    if (t.type === "expense" && fixedCategoriesSet.has(t.tertiaryCategory)) {
      fixedExpenses += t.amount;
    }
  }

  const ratio = totalIncome > 0 ? fixedExpenses / totalIncome : 0;

  let score = 0;
  if (ratio <= 0.3) score = 25;
  else if (ratio <= 0.4) score = 20;
  else if (ratio <= 0.5) score = 15;
  else if (ratio <= 0.6) score = 10;
  else score = 5;

  return {
    score,
    maxScore: 25,
    details: {
      fixedExpenseRatio: ratio,
      fixedExpenseAmount: fixedExpenses,
      totalIncome,
      interpretation: ratio <= 0.3 ? "财务结构健康" : "刚性支出偏高",
    },
  };
}

// ── Dimension 3: Quality (15%) ──

function calculateQualityScore(transactions: DomainTransaction[] | undefined): QualityScoreResult {
  const incomeBySource = new Map<string, number>();
  let totalIncome = 0;

  for (const t of transactions ?? []) {
    if (t.type === "income") {
      const source = t.primaryCategory;
      incomeBySource.set(source, (incomeBySource.get(source) ?? 0) + t.amount);
      totalIncome += t.amount;
    }
  }

  const sourceCount = incomeBySource.size;
  if (sourceCount === 0) {
    return {
      score: 0,
      maxScore: 15,
      details: { hhi: 1, incomeSourceCount: 0, interpretation: "暂无收入数据" },
    };
  }

  const hhi = calculateHHI(incomeBySource, totalIncome);

  let score = 0;
  if (hhi <= 0.3) score = 15;
  else if (hhi <= 0.5) score = 12;
  else if (hhi <= 0.7) score = 9;
  else if (hhi <= 0.85) score = 6;
  else score = 3;

  return {
    score,
    maxScore: 15,
    details: {
      hhi,
      incomeSourceCount: sourceCount,
      interpretation: hhi <= 0.5 ? "收入来源多元化" : "收入来源较单一",
    },
  };
}

// ── Dimension 4: Resilience (20%) ──

function calculateResilienceScore(
  monthlyData: Pick<MonthlyData, "income" | "expense">[],
): ResilienceScoreResult {
  if (monthlyData.length < 3) {
    return {
      score: 10,
      maxScore: 20,
      details: {
        negativeCashflowMonths: 0,
        totalMonths: monthlyData.length,
        cashflowCV: 0,
        interpretation: "数据不足",
      },
    };
  }

  const cashflows = monthlyData.map((d) => d.income - d.expense);
  const negativeMonths = cashflows.filter((cf) => cf < 0).length;
  const cv = coefficientOfVariation(cashflows);
  const negativeRatio = negativeMonths / monthlyData.length;

  let score = 0;
  if (negativeRatio === 0 && cv < 0.3) score = 20;
  else if (negativeRatio <= 0.1 && cv < 0.5) score = 16;
  else if (negativeRatio <= 0.2 && cv < 0.7) score = 12;
  else if (negativeRatio <= 0.3) score = 8;
  else score = 4;

  return {
    score,
    maxScore: 20,
    details: {
      negativeCashflowMonths: negativeMonths,
      totalMonths: monthlyData.length,
      cashflowCV: cv,
      interpretation: negativeRatio === 0 ? "现金流稳定" : "存在现金流风险",
    },
  };
}

// ── Dimension 5: Savings (20%) ──

function calculateSavingsScore(
  monthlyData: Pick<MonthlyData, "income" | "expense">[],
): SavingsScoreResult {
  if (monthlyData.length === 0) {
    return {
      score: 0,
      maxScore: 20,
      details: { weightedSavingsRate: 0, interpretation: "无数据" },
    };
  }

  const totalIncome = monthlyData.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = monthlyData.reduce((sum, d) => sum + d.expense, 0);
  const annualSavingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;

  let score = 0;
  if (annualSavingsRate >= 0.3) score = 20;
  else if (annualSavingsRate >= 0.2) score = 16;
  else if (annualSavingsRate >= 0.1) score = 12;
  else if (annualSavingsRate >= 0) score = 8;
  else score = 0;

  return {
    score,
    maxScore: 20,
    details: {
      weightedSavingsRate: annualSavingsRate,
      interpretation:
        annualSavingsRate >= 0.2
          ? "储蓄能力优秀"
          : annualSavingsRate >= 0.1
            ? "储蓄能力一般"
            : "储蓄不足",
    },
  };
}

// ── Main Calculation ──

export interface FinancialHealthResult {
  totalScore: number;
  maxScore: 100;
  grade: "A+" | "A" | "B" | "C" | "D";
  dimensions: {
    growth: GrowthScoreResult;
    rigidity: RigidityScoreResult;
    quality: QualityScoreResult;
    resilience: ResilienceScoreResult;
    savings: SavingsScoreResult;
  };
  monthlyRegression: {
    incomeTrend: { slope: number; intercept: number };
    expenseTrend: { slope: number; intercept: number };
  };
}

export function calculateFinancialHealth(
  transactions: DomainTransaction[] | undefined,
  monthlyData: Pick<MonthlyData, "income" | "expense">[],
  totalIncome: number,
  fixedExpenseCategories: string[] = [],
): FinancialHealthResult {
  const safeMonthlyData = Array.isArray(monthlyData) ? monthlyData : [];
  const safeTotalIncome = Number.isFinite(totalIncome) ? totalIncome : 0;

  const growth = calculateGrowthScore(safeMonthlyData);
  const rigidity = calculateRigidityScore(transactions, safeTotalIncome, fixedExpenseCategories);
  const quality = calculateQualityScore(transactions);
  const resilience = calculateResilienceScore(safeMonthlyData);
  const savings = calculateSavingsScore(safeMonthlyData);

  const incomeTrend = linearRegression(safeMonthlyData.map((d) => d.income));
  const expenseTrend = linearRegression(safeMonthlyData.map((d) => d.expense));

  const totalScore =
    growth.score + rigidity.score + quality.score + resilience.score + savings.score;

  const percentage = totalScore / 100;
  let grade: FinancialHealthResult["grade"];
  if (percentage >= 0.9) grade = "A+";
  else if (percentage >= 0.8) grade = "A";
  else if (percentage >= 0.7) grade = "B";
  else if (percentage >= 0.6) grade = "C";
  else grade = "D";

  return {
    totalScore,
    maxScore: 100,
    grade,
    dimensions: { growth, rigidity, quality, resilience, savings },
    monthlyRegression: { incomeTrend, expenseTrend },
  };
}

// Export individual functions for testing
export const healthAlgorithm = {
  linearRegression,
  coefficientOfVariation,
  calculateHHI,
  calculateGrowthScore,
  calculateRigidityScore,
  calculateQualityScore,
  calculateResilienceScore,
  calculateSavingsScore,
};
