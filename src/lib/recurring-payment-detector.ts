/**
 * Recurring Payment Detector
 *
 * Pure-function module that detects recurring payments from transaction data
 * using statistical periodicity analysis. No external API calls.
 */

import type { DomainTransaction, RecurringPayment, PaymentInsight } from "@/domain/types";

// ── Internal types ──

interface PeriodicityPattern {
  category: string;
  description: string;
  account: string;
  intervals: number[];
  averageInterval: number;
  standardDeviation: number;
  consistency: "high" | "medium" | "low";
  lastPaymentDate: string;
  predictedNextDate: string;
  monthlyAmount: number;
  yearlyTotal: number;
}

type Frequency = "monthly" | "quarterly" | "yearly" | "weekly" | "biweekly";

// ── Helpers ──

function differenceInDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addPeriod(date: Date, frequency: Frequency): Date {
  const d = new Date(date);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

// ── Core algorithm ──

function groupTransactions(transactions: DomainTransaction[]): Record<string, DomainTransaction[]> {
  const groups: Record<string, DomainTransaction[]> = {};
  for (const tx of transactions) {
    const key = `${tx.primaryCategory}-${tx.tertiaryCategory}-${tx.account}`;
    const group = groups[key];
    if (group) {
      group.push(tx);
    } else {
      groups[key] = [tx];
    }
  }
  return groups;
}

function calculateConsistency(stdDev: number, mean: number): "high" | "medium" | "low" {
  const coefficient = stdDev / mean;
  if (coefficient <= 0.1) return "high";
  if (coefficient <= 0.25) return "medium";
  return "low";
}

function inferFrequency(averageDays: number): Frequency {
  if (Math.abs(averageDays - 7) <= 3) return "weekly";
  if (Math.abs(averageDays - 14) <= 4) return "biweekly";
  if (Math.abs(averageDays - 30) <= 5) return "monthly";
  if (Math.abs(averageDays - 90) <= 10) return "quarterly";
  if (Math.abs(averageDays - 365) <= 30) return "yearly";
  return "monthly";
}

function calculateMonthlyAmount(transactions: DomainTransaction[], averageDays: number): number {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  if (averageDays <= 7) return total * 4.33;
  if (averageDays <= 14) return total * 2.17;
  if (averageDays <= 90) return total / (averageDays / 30);
  return total / 12;
}

function calculateYearlyTotal(transactions: DomainTransaction[], averageDays: number): number {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  if (averageDays <= 7) return total * 52;
  if (averageDays <= 14) return total * 26;
  if (averageDays <= 90) return total * (365 / averageDays);
  return total;
}

function analyzePeriodicity(transactions: DomainTransaction[]): PeriodicityPattern[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const intervals: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (!prev || !curr) continue;
    const daysDiff = differenceInDays(new Date(curr.date), new Date(prev.date));
    if (daysDiff > 0 && daysDiff <= 400) {
      intervals.push(daysDiff);
    }
  }

  if (intervals.length < 2) return [];

  const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const variance =
    intervals.reduce((sum, interval) => sum + Math.pow(interval - averageInterval, 2), 0) /
    intervals.length;
  const standardDeviation = Math.sqrt(variance);

  const consistency = calculateConsistency(standardDeviation, averageInterval);
  const frequency = inferFrequency(averageInterval);
  const lastPayment = sorted[sorted.length - 1];
  if (!lastPayment) return [];
  const first = sorted[0];
  if (!first) return [];
  const predictedNext = formatDate(addPeriod(new Date(lastPayment.date), frequency));

  return [
    {
      category: first.primaryCategory,
      description: first.tertiaryCategory,
      account: first.account,
      intervals,
      averageInterval,
      standardDeviation,
      consistency,
      lastPaymentDate: lastPayment.date,
      predictedNextDate: predictedNext,
      monthlyAmount: calculateMonthlyAmount(sorted, averageInterval),
      yearlyTotal: calculateYearlyTotal(sorted, averageInterval),
    },
  ];
}

function createRecurringPayment(
  pattern: PeriodicityPattern,
  transactions: DomainTransaction[],
): RecurringPayment {
  const recentTransactions = transactions.slice(-3);
  const avgAmount =
    recentTransactions.reduce((sum, t) => sum + t.amount, 0) / (recentTransactions.length || 1);

  return {
    id: `${pattern.account}-${pattern.description}`,
    description: pattern.description,
    account: pattern.account,
    amount: avgAmount,
    frequency: inferFrequency(pattern.averageInterval),
    nextPaymentDate: pattern.predictedNextDate,
    averageInterval: Math.round(pattern.averageInterval),
    occurrences: transactions.length,
    totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
    yearlyTotal: pattern.yearlyTotal,
    category: pattern.category,
    recentTransactions: recentTransactions.map((t) => ({
      date: t.date,
      amount: t.amount,
      description: t.tertiaryCategory,
    })),
  };
}

function deduplicatePayments(payments: RecurringPayment[]): RecurringPayment[] {
  const seen = new Set<string>();
  return payments.filter((payment) => {
    const key = `${payment.account}-${payment.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Public API ──

/**
 * Detect recurring payments from a list of transactions using
 * statistical periodicity analysis.
 */
export function detectRecurringPayments(transactions: DomainTransaction[]): RecurringPayment[] {
  const categoryGroups = groupTransactions(transactions);
  const recurringPayments: RecurringPayment[] = [];

  for (const group of Object.values(categoryGroups)) {
    if (group.length < 3) continue;

    const patterns = analyzePeriodicity(group);
    for (const pattern of patterns) {
      if (pattern.consistency === "high" || pattern.consistency === "medium") {
        recurringPayments.push(createRecurringPayment(pattern, group));
      }
    }
  }

  return deduplicatePayments(recurringPayments);
}

/**
 * Generate payment insights (overdue, upcoming, budget alerts) from
 * detected recurring payments.
 */
export function generatePaymentInsights(recurringPayments: RecurringPayment[]): PaymentInsight[] {
  const insights: PaymentInsight[] = [];
  const today = new Date();

  for (const payment of recurringPayments) {
    const nextPaymentDate = new Date(payment.nextPaymentDate);
    const daysUntilNext = differenceInDays(nextPaymentDate, today);

    // Overdue or due today
    if (daysUntilNext <= 0 && daysUntilNext >= -7) {
      insights.push({
        type: "recurring_payment",
        priority: "high",
        title: `需要支付：${payment.description}`,
        description: `${payment.account}的${payment.description}费用已到期或即将到期`,
        amount: payment.amount,
        dueDate: payment.nextPaymentDate,
        recommendation: `建议立即处理${payment.description}的支付，避免逾期`,
        confidence: 0.9,
      });
    }
    // Upcoming within 7 days
    else if (daysUntilNext <= 7 && daysUntilNext > 0) {
      insights.push({
        type: "upcoming_renewal",
        priority: "medium",
        title: `即将到期：${payment.description}`,
        description: `${payment.account}的${payment.description}将在${daysUntilNext}天后到期`,
        amount: payment.amount,
        dueDate: payment.nextPaymentDate,
        recommendation: `准备资金用于${daysUntilNext}天后的${payment.description}续费`,
        confidence: 0.8,
      });
    }

    // Budget alert for high monthly expenses
    if (payment.yearlyTotal > 12000 && payment.frequency === "monthly") {
      insights.push({
        type: "budget_alert",
        priority: "medium",
        title: `高额月度支出：${payment.description}`,
        description: `${payment.description}年度总支出达${payment.yearlyTotal.toLocaleString()}元，占总支出比例较高`,
        amount: payment.yearlyTotal / 12,
        recommendation: "考虑是否有更经济的替代方案或优化使用方式",
        confidence: 0.7,
      });
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
