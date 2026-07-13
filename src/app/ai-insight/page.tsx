import { AppShell } from "@/components/layout";
import {
  buildInsightSummaryData,
  sortInsightsByPriority,
  sortRecurringPaymentsByNextDate,
} from "@/domain/dashboard/ai-insight";
import type { DomainTransaction } from "@/domain/types";
import { getAuthedClient } from "@/lib/api-helpers";
import { detectRecurringPayments, generatePaymentInsights } from "@/lib/recurring-payment-detector";
import { toDomainTransaction } from "@/lib/transaction-mappers";
import { AIInsightClient } from "./ai-insight-client";

export default async function AIInsightPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  let transactions: DomainTransaction[] = [];
  let selectedYear: number | null = null;

  try {
    const { userId, client } = await getAuthedClient();
    const metadata = await client.getMetadata(userId);

    const availableYears = metadata.years.sort((a, b) => b - a);
    const yearParam = params.year ? Number(params.year) : null;
    if (yearParam && availableYears.includes(yearParam)) {
      selectedYear = yearParam;
    } else {
      selectedYear = availableYears[0] ?? new Date().getFullYear();
    }

    const result = await client.getAllTransactionsByYear(userId, selectedYear);
    transactions = result.transactions.map((raw) =>
      toDomainTransaction(raw as Record<string, unknown>),
    );
  } catch {
    // Not authenticated or Worker unavailable
  }

  // Detect recurring payments & generate insights on server
  const recurringPayments = detectRecurringPayments(transactions);
  const rawInsights = generatePaymentInsights(recurringPayments);

  // Sort & summarize
  const sortedPayments = sortRecurringPaymentsByNextDate(recurringPayments);
  const sortedInsights = sortInsightsByPriority(rawInsights);
  const summary = buildInsightSummaryData(recurringPayments, rawInsights);

  // Data range
  const dates = transactions.map((t) => t.date).sort();
  const startDate = dates[0] ?? "";
  const endDate = dates[dates.length - 1] ?? "";

  return (
    <AppShell>
      <AIInsightClient
        sortedPayments={sortedPayments}
        sortedInsights={sortedInsights}
        summary={summary}
        dataRange={{
          startDate,
          endDate,
          transactionCount: transactions.length,
        }}
      />
    </AppShell>
  );
}
