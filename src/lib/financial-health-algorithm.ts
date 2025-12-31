import { Transaction } from '@/types/transaction';

/**
 * Financial Health Core - 5-Dimensional Assessment Algorithm
 * 财务健康核心 - 5维度反脆弱评估算法
 */

// ============================================
// Utility Functions
// ============================================

/**
 * Linear Regression - Calculate slope and intercept
 * 线性回归 - 计算斜率和截距
 */
function linearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: 0 };

  const xValues = Array.from({ length: n }, (_, i) => i);
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = data.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * data[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope: isNaN(slope) ? 0 : slope, intercept };
}

/**
 * Calculate Coefficient of Variation (CV)
 * 计算变异系数
 */
function coefficientOfVariation(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  return mean === 0 ? 0 : stdDev / mean;
}

/**
 * Herfindahl-Hirschman Index (HHI) for income concentration
 * 赫芬达尔指数 - 衡量收入集中度
 */
function calculateHHI(incomeBySource: Map<string, number>, totalIncome: number): number {
  if (totalIncome === 0) return 1;
  let hhi = 0;
  for (const amount of incomeBySource.values()) {
    const share = amount / totalIncome;
    hhi += share * share;
  }
  return hhi;
}

// ============================================
// Dimension 1: Growth - 剪刀差动能分析 (Weight: 20%)
// ============================================

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

function calculateGrowthScore(monthlyData: { income: number; expense: number }[]): GrowthScoreResult {
  // Need at least 6 months of data
  if (monthlyData.length < 6) {
    return {
      score: 10,
      maxScore: 20,
      details: {
        incomeSlope: 0,
        expenseSlope: 0,
        trendDifference: 0,
        interpretation: '数据不足（需至少6个月）',
      },
    };
  }

  const last12Months = monthlyData.slice(-12);
  const incomeData = last12Months.map(d => d.income);
  const expenseData = last12Months.map(d => d.expense);

  const incomeRegression = linearRegression(incomeData);
  const expenseRegression = linearRegression(expenseData);

  const incomeSlope = incomeRegression.slope;
  const expenseSlope = expenseRegression.slope;
  const trendDiff = incomeSlope - expenseSlope;

  // Score based on trend difference
  let score = 10; // Base score
  if (trendDiff > 0) {
    // Income growing faster than expenses - great!
    score = 20;
  } else if (trendDiff > -expenseSlope * 0.1) {
    // Expenses growing slightly faster, but acceptable
    score = 15;
  } else if (trendDiff > -expenseSlope * 0.3) {
    // Expenses growing noticeably faster - warning
    score = 10;
  } else {
    // Expenses growing much faster - poor
    score = 5;
  }

  return {
    score,
    maxScore: 20,
    details: {
      incomeSlope,
      expenseSlope,
      trendDifference: trendDiff,
      interpretation: trendDiff > 0 ? '收入增长跑赢支出' : '支出增长快于收入',
    },
  };
}

// ============================================
// Dimension 2: Rigidity - 生存覆盖率 (Weight: 25%)
// ============================================

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

function calculateRigidityScore(
  transactions: Transaction[] | undefined,
  totalIncome: number,
  fixedExpenseCategories: string[] = []
): RigidityScoreResult {
  // Calculate fixed expenses using user-configured categories
  let fixedExpenses = 0;
  const safeTransactions = transactions || [];
  const fixedCategoriesSet = new Set(fixedExpenseCategories);

  for (const t of safeTransactions) {
    if (t.type === 'expense' && fixedCategoriesSet.has(t.tertiaryCategory)) {
      fixedExpenses += t.amount;
    }
  }

  const ratio = totalIncome > 0 ? fixedExpenses / totalIncome : 0;

  // Score based on fixed expense ratio
  let score = 0;
  if (ratio <= 0.3) {
    score = 25; // Excellent: <30%
  } else if (ratio <= 0.4) {
    score = 20; // Good: 30-40%
  } else if (ratio <= 0.5) {
    score = 15; // Fair: 40-50%
  } else if (ratio <= 0.6) {
    score = 10; // Poor: 50-60%
  } else {
    score = 5;  // Critical: >60%
  }

  return {
    score,
    maxScore: 25,
    details: {
      fixedExpenseRatio: ratio,
      fixedExpenseAmount: fixedExpenses,
      totalIncome,
      interpretation: ratio <= 0.3 ? '财务结构健康' : '刚性支出偏高',
    },
  };
}

// ============================================
// Dimension 3: Quality - 收入反脆弱性 (Weight: 15%)
// ============================================

interface QualityScoreResult {
  score: number;
  maxScore: 15;
  details: {
    hhi: number;
    incomeSourceCount: number;
    interpretation: string;
  };
}

function calculateQualityScore(transactions: Transaction[] | undefined): QualityScoreResult {
  // Aggregate income by source (using primaryCategory as source proxy)
  const incomeBySource = new Map<string, number>();
  let totalIncome = 0;

  const safeTransactions = transactions || [];
  for (const t of safeTransactions) {
    if (t.type === 'income') {
      const source = t.primaryCategory;
      incomeBySource.set(source, (incomeBySource.get(source) || 0) + t.amount);
      totalIncome += t.amount;
    }
  }

  const sourceCount = incomeBySource.size;

  // Handle no income data case
  if (sourceCount === 0) {
    return {
      score: 0,
      maxScore: 15,
      details: {
        hhi: 1,
        incomeSourceCount: 0,
        interpretation: '暂无收入数据',
      },
    };
  }

  const hhi = calculateHHI(incomeBySource, totalIncome);

  // Score based on HHI (lower is better - more diverse)
  let score = 0;
  if (hhi <= 0.3) {
    score = 15; // Excellent: Very diverse income sources
  } else if (hhi <= 0.5) {
    score = 12; // Good: Moderately diverse
  } else if (hhi <= 0.7) {
    score = 9;  // Fair: Some concentration
  } else if (hhi <= 0.85) {
    score = 6;  // Poor: High concentration
  } else {
    score = 3;  // Critical: Single source dependency
  }

  return {
    score,
    maxScore: 15,
    details: {
      hhi,
      incomeSourceCount: sourceCount,
      interpretation: hhi <= 0.5 ? '收入来源多元化' : '收入来源较单一',
    },
  };
}

// ============================================
// Dimension 4: Resilience - 安全边际 (Weight: 20%)
// ============================================

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

function calculateResilienceScore(monthlyData: { income: number; expense: number }[]): ResilienceScoreResult {
  if (monthlyData.length < 3) {
    return {
      score: 10,
      maxScore: 20,
      details: {
        negativeCashflowMonths: 0,
        totalMonths: monthlyData.length,
        cashflowCV: 0,
        interpretation: '数据不足',
      },
    };
  }

  // Calculate free cash flow for each month
  const cashflows = monthlyData.map(d => d.income - d.expense);
  const negativeMonths = cashflows.filter(cf => cf < 0).length;
  const cv = coefficientOfVariation(cashflows);

  // Score based on negative months and CV
  let score = 0;
  const negativeRatio = negativeMonths / monthlyData.length;

  if (negativeRatio === 0 && cv < 0.3) {
    score = 20; // Excellent: Never negative, low volatility
  } else if (negativeRatio <= 0.1 && cv < 0.5) {
    score = 16; // Good: Rarely negative, moderate volatility
  } else if (negativeRatio <= 0.2 && cv < 0.7) {
    score = 12; // Fair: Some negative months
  } else if (negativeRatio <= 0.3) {
    score = 8;  // Poor: Frequent negative months
  } else {
    score = 4;  // Critical: Often negative
  }

  return {
    score,
    maxScore: 20,
    details: {
      negativeCashflowMonths: negativeMonths,
      totalMonths: monthlyData.length,
      cashflowCV: cv,
      interpretation: negativeRatio === 0 ? '现金流稳定' : '存在现金流风险',
    },
  };
}

// ============================================
// Dimension 5: Savings - 基础蓄水能力 (Weight: 20%)
// ============================================

interface SavingsScoreResult {
  score: number;
  maxScore: 20;
  details: {
    weightedSavingsRate: number;
    interpretation: string;
  };
}

function calculateSavingsScore(
  monthlyData: { income: number; expense: number }[]
): SavingsScoreResult {
  if (monthlyData.length === 0) {
    return {
      score: 0,
      maxScore: 20,
      details: {
        weightedSavingsRate: 0,
        interpretation: '无数据',
      }
    };
  }

  // Calculate annual savings rate (total savings / total income) - same as SavingsRateChart
  const totalIncome = monthlyData.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = monthlyData.reduce((sum, d) => sum + d.expense, 0);
  const totalSavings = totalIncome - totalExpense;
  const annualSavingsRate = totalIncome > 0 ? totalSavings / totalIncome : 0;

  // Score based on savings rate
  let score = 0;
  if (annualSavingsRate >= 0.3) {
    score = 20; // Excellent: 30%+
  } else if (annualSavingsRate >= 0.2) {
    score = 16; // Good: 20-30%
  } else if (annualSavingsRate >= 0.1) {
    score = 12; // Fair: 10-20%
  } else if (annualSavingsRate >= 0) {
    score = 8;  // Poor: 0-10%
  } else {
    score = 0;  // Critical: Negative
  }

  return {
    score,
    maxScore: 20,
    details: {
      weightedSavingsRate: annualSavingsRate,
      interpretation: annualSavingsRate >= 0.2 ? '储蓄能力优秀' : annualSavingsRate >= 0.1 ? '储蓄能力一般' : '储蓄不足',
    },
  };
}

// ============================================
// Main Calculation Function
// ============================================

export interface FinancialHealthResult {
  totalScore: number;
  maxScore: 100;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
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

/**
 * Main function to calculate financial health score
 * 计算财务健康评分的主函数
 */
export function calculateFinancialHealth(
  transactions: Transaction[] | undefined,
  monthlyData: { income: number; expense: number }[],
  totalIncome: number,
  fixedExpenseCategories: string[] = []
): FinancialHealthResult {
  // Calculate all 5 dimensions
  const growth = calculateGrowthScore(monthlyData);
  const rigidity = calculateRigidityScore(transactions, totalIncome, fixedExpenseCategories);
  const quality = calculateQualityScore(transactions);
  const resilience = calculateResilienceScore(monthlyData);
  const savings = calculateSavingsScore(monthlyData);

  // Calculate regression trends for visualization
  const incomeTrend = linearRegression(monthlyData.map(d => d.income));
  const expenseTrend = linearRegression(monthlyData.map(d => d.expense));

  const totalScore = growth.score + rigidity.score + quality.score + resilience.score + savings.score;
  const maxScore = 100;

  // Determine grade
  const percentage = totalScore / maxScore;
  let grade: FinancialHealthResult['grade'];
  if (percentage >= 0.9) grade = 'A+';
  else if (percentage >= 0.8) grade = 'A';
  else if (percentage >= 0.7) grade = 'B';
  else if (percentage >= 0.6) grade = 'C';
  else grade = 'D';

  return {
    totalScore,
    maxScore,
    grade,
    dimensions: {
      growth,
      rigidity,
      quality,
      resilience,
      savings,
    },
    monthlyRegression: {
      incomeTrend,
      expenseTrend,
    },
  };
}

// Export individual calculation functions for testing
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
