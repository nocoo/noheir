import { describe, expect, it } from "vitest";
import {
  buildInsightSummaryData,
  sortInsightsByPriority,
  sortRecurringPaymentsByNextDate,
} from "@/domain/dashboard/ai-insight";
import type { PaymentInsight, RecurringPayment } from "@/domain/types";

describe("ai-insight domain", () => {
  it("builds summary data", () => {
    const payments: RecurringPayment[] = [
      {
        id: "p1",
        description: "A",
        account: "A",
        amount: 10,
        frequency: "monthly",
        nextPaymentDate: "2024-01-01",
        averageInterval: 30,
        occurrences: 3,
        totalAmount: 30,
        category: "A",
        yearlyTotal: 1200,
        recentTransactions: [],
      },
    ];
    const insights: PaymentInsight[] = [
      {
        type: "recurring_payment",
        priority: "high",
        title: "A",
        description: "A",
        recommendation: "A",
        confidence: 0.9,
      },
    ];
    const summary = buildInsightSummaryData(payments, insights);
    expect(summary.paymentsCount).toBe(1);
    expect(summary.highPriorityCount).toBe(1);
  });

  it("sorts insights by priority", () => {
    const sorted = sortInsightsByPriority([
      {
        type: "recurring_payment",
        priority: "low",
        title: "A",
        description: "A",
        recommendation: "A",
        confidence: 0.6,
      },
      {
        type: "recurring_payment",
        priority: "high",
        title: "B",
        description: "B",
        recommendation: "B",
        confidence: 0.6,
      },
    ]);
    expect(sorted[0]?.priority).toBe("high");
  });

  it("sorts recurring payments by next date", () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const later = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sorted = sortRecurringPaymentsByNextDate([
      {
        id: "p1",
        description: "A",
        account: "A",
        amount: 10,
        frequency: "monthly",
        nextPaymentDate: later,
        averageInterval: 30,
        occurrences: 3,
        totalAmount: 30,
        category: "A",
        yearlyTotal: 120,
        recentTransactions: [],
      },
      {
        id: "p2",
        description: "B",
        account: "B",
        amount: 10,
        frequency: "monthly",
        nextPaymentDate: soon,
        averageInterval: 30,
        occurrences: 3,
        totalAmount: 30,
        category: "B",
        yearlyTotal: 120,
        recentTransactions: [],
      },
    ]);
    expect(sorted[0]?.nextPaymentDate).toBe(soon);
  });
});
