import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { buildSavingsRate } from "@/domain/dashboard/overview";
import type { DomainTransaction, MonthlyData } from "@/domain/types";
import { MONTH_NAMES } from "@/lib/constants";
import { financeApi } from "@/lib/finance-api";
import { toDomainTransaction } from "@/lib/transaction-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { OverviewClient } from "./overview-client";

export interface OverviewLoaderData {
  transactions: DomainTransaction[];
  monthlyData: MonthlyData[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
  savingsRate: number;
  targetSavingsRate: number;
  selectedYear: number;
}

export async function overviewLoader({
  request,
}: {
  request: Request;
}): Promise<OverviewLoaderData> {
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

  const [summary, recentResult, settingsResult] = await Promise.all([
    workerDbClient.getYearlySummary(selectedYear, "CNY"),
    workerDbClient.searchTransactions({ year: selectedYear, limit: 10, currency: "CNY" }),
    financeApi.getFinancialPreferences(),
  ]);

  const targetSavingsRate = settingsResult.data.savingsRateTarget;

  const monthlyData: MonthlyData[] = summary.months.map((m) => ({
    month: MONTH_NAMES[m.month - 1] ?? `${m.month}月`,
    income: m.income / 100,
    expense: m.expense / 100,
    balance: (m.income - m.expense) / 100,
  }));

  const totalIncome = summary.totals.income / 100;
  const totalExpense = summary.totals.expense / 100;
  const balance = totalIncome - totalExpense;
  const savingsRate = buildSavingsRate(totalIncome, totalExpense);

  const transactions = recentResult.transactions
    .map((raw) => toDomainTransaction(raw as Record<string, unknown>))
    .filter((row) => row.currency === "CNY");

  return {
    transactions,
    monthlyData,
    totalIncome,
    totalExpense,
    balance,
    savingsRate,
    targetSavingsRate,
    selectedYear,
  };
}

export default function OverviewPage() {
  const data = useLoaderData<OverviewLoaderData>();

  return (
    <AppShell>
      <OverviewClient
        transactions={data.transactions}
        monthlyData={data.monthlyData}
        totalIncome={data.totalIncome}
        totalExpense={data.totalExpense}
        balance={data.balance}
        savingsRate={data.savingsRate}
        targetSavingsRate={data.targetSavingsRate}
      />
    </AppShell>
  );
}
