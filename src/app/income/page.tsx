import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import {
  buildAverageMonthly,
  buildFilteredTransactions,
  buildMonthlyFiltered,
  buildTopTransactions,
  buildTotalAmount,
  buildTransactionLabels,
} from "@/domain/dashboard/transaction-analysis";
import type { DomainTransaction } from "@/domain/types";
import { buildAccountData, buildCategoryData } from "@/lib/category-builders";
import { buildMonthlyData, toDomainTransaction } from "@/lib/transaction-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { TransactionAnalysisClient } from "../transaction-analysis-client";

export interface IncomeLoaderData {
  transactions: DomainTransaction[];
  selectedYear: number;
}

export async function incomeLoader({ request }: { request: Request }): Promise<IncomeLoaderData> {
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
  const transactions = result.transactions.map((raw) =>
    toDomainTransaction(raw as Record<string, unknown>),
  );

  return { transactions, selectedYear };
}

export default function IncomePage() {
  const { transactions } = useLoaderData<IncomeLoaderData>();

  const type = "income" as const;
  const filtered = buildFilteredTransactions(transactions, type);
  const totalAmount = buildTotalAmount(filtered);
  const monthlyData = buildMonthlyData(transactions);
  const monthlyFiltered = buildMonthlyFiltered(monthlyData, type);
  const avgMonthly = buildAverageMonthly(monthlyFiltered, type);
  const topTransactions = buildTopTransactions(filtered, 50);
  const labels = buildTransactionLabels(type);
  const { chartData, detailList } = buildCategoryData(filtered, totalAmount);
  const accountData = buildAccountData(filtered, totalAmount, 10);

  return (
    <AppShell>
      <TransactionAnalysisClient
        type={type}
        totalAmount={totalAmount}
        avgMonthly={avgMonthly}
        transactionCount={filtered.length}
        monthlyData={monthlyData}
        chartData={chartData}
        detailList={detailList}
        accountData={accountData}
        topTransactions={topTransactions.map((t) => ({
          id: t.id,
          date: t.date,
          primaryCategory: t.primaryCategory,
          secondaryCategory: t.secondaryCategory,
          tertiaryCategory: t.tertiaryCategory,
          account: t.account,
          description: t.note,
          amount: t.amount,
        }))}
        labels={labels}
      />
    </AppShell>
  );
}
