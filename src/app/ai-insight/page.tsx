import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import {
  buildInsightSummaryData,
  sortInsightsByPriority,
  sortRecurringPaymentsByNextDate,
} from "@/domain/dashboard/ai-insight";
import type { DomainTransaction } from "@/domain/types";
import { detectRecurringPayments, generatePaymentInsights } from "@/lib/recurring-payment-detector";
import { toDomainTransaction } from "@/lib/transaction-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { AIInsightClient } from "./ai-insight-client";

export interface AIInsightLoaderData {
  sortedPayments: ReturnType<typeof sortRecurringPaymentsByNextDate>;
  sortedInsights: ReturnType<typeof sortInsightsByPriority>;
  summary: ReturnType<typeof buildInsightSummaryData>;
  dataRange: {
    startDate: string;
    endDate: string;
    transactionCount: number;
  };
}

export async function aiInsightLoader({
  request,
}: {
  request: Request;
}): Promise<AIInsightLoaderData> {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  const metadata = await workerDbClient.getMetadata();
  const availableYears = metadata.years.sort((a, b) => b - a);
  const parsedYear = yearParam ? Number(yearParam) : null;
  let selectedYear: number;
  if (parsedYear && availableYears.includes(parsedYear)) {
    selectedYear = parsedYear;
  } else {
    selectedYear = availableYears[0] ?? new Date().getFullYear();
  }

  const result = await workerDbClient.getAllTransactionsByYear(selectedYear);
  const transactions: DomainTransaction[] = result.transactions.map((raw) =>
    toDomainTransaction(raw as Record<string, unknown>),
  );

  const recurringPayments = detectRecurringPayments(transactions);
  const rawInsights = generatePaymentInsights(recurringPayments);

  const sortedPayments = sortRecurringPaymentsByNextDate(recurringPayments);
  const sortedInsights = sortInsightsByPriority(rawInsights);
  const summary = buildInsightSummaryData(recurringPayments, rawInsights);

  const dates = transactions.map((t) => t.date).sort();
  const startDate = dates[0] ?? "";
  const endDate = dates[dates.length - 1] ?? "";

  return {
    sortedPayments,
    sortedInsights,
    summary,
    dataRange: {
      startDate,
      endDate,
      transactionCount: transactions.length,
    },
  };
}

export default function AIInsightPage() {
  const { sortedPayments, sortedInsights, summary, dataRange } =
    useLoaderData<AIInsightLoaderData>();

  return (
    <AppShell>
      <AIInsightClient
        sortedPayments={sortedPayments}
        sortedInsights={sortedInsights}
        summary={summary}
        dataRange={dataRange}
      />
    </AppShell>
  );
}
