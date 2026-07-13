import type { RecurringPayment, PaymentInsight } from "../types";

export const buildInsightSummaryData = (
  payments: RecurringPayment[],
  insights: PaymentInsight[],
) => {
  const highPriorityCount = insights.filter((i) => i.priority === "high").length;
  const yearlyTotal = payments.reduce((sum, p) => sum + p.yearlyTotal, 0);
  const monthlyTotal = yearlyTotal / 12;

  return {
    paymentsCount: payments.length,
    monthlyTotal,
    yearlyTotal,
    highPriorityCount,
  };
};

export const sortInsightsByPriority = (insights: PaymentInsight[]) => {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...insights].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
};

export const sortRecurringPaymentsByNextDate = (payments: RecurringPayment[]) => {
  return [...payments].sort((a, b) => {
    const daysA = Math.abs(new Date(a.nextPaymentDate).getTime() - Date.now());
    const daysB = Math.abs(new Date(b.nextPaymentDate).getTime() - Date.now());
    return daysA - daysB;
  });
};
