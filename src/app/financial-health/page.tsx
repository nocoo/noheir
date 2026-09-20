import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import {
  buildFinancialHealthResult,
  buildSafeMonthlyData,
  buildSafeTotalIncome,
} from "@/domain/dashboard/financial-health";
import type { DomainTransaction, MonthlyData } from "@/domain/types";
import { MONTH_NAMES } from "@/lib/constants";
import { toDomainTransaction } from "@/lib/transaction-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { FinancialHealthClient } from "./financial-health-client";

export interface FinancialHealthLoaderData {
  healthResult: ReturnType<typeof buildFinancialHealthResult>;
  monthlyData: ReturnType<typeof buildSafeMonthlyData>;
}

export async function financialHealthLoader({
  request,
}: {
  request: Request;
}): Promise<FinancialHealthLoaderData> {
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

  const [summary, txResult] = await Promise.all([
    workerDbClient.getYearlySummary(selectedYear),
    workerDbClient.getAllTransactionsByYear(selectedYear),
  ]);

  const monthlyData: MonthlyData[] = summary.months.map((m) => ({
    month: MONTH_NAMES[m.month - 1] ?? `${m.month}月`,
    income: m.income / 100,
    expense: m.expense / 100,
    balance: (m.income - m.expense) / 100,
  }));

  const totalIncome = summary.totals.income / 100;
  const transactions: DomainTransaction[] = txResult.transactions.map((raw) =>
    toDomainTransaction(raw as Record<string, unknown>),
  );

  const safeMonthly = buildSafeMonthlyData(monthlyData);
  const safeTotalIncome = buildSafeTotalIncome(totalIncome);
  const fixedExpenseCategories: string[] = [];

  const healthResult = buildFinancialHealthResult(
    transactions,
    safeMonthly,
    safeTotalIncome,
    fixedExpenseCategories,
  );

  return { healthResult, monthlyData: safeMonthly };
}

export default function FinancialHealthPage() {
  const { healthResult, monthlyData } = useLoaderData<FinancialHealthLoaderData>();

  return (
    <AppShell>
      <FinancialHealthClient healthResult={healthResult} monthlyData={monthlyData} />
    </AppShell>
  );
}
