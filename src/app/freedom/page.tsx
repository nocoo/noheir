import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { buildFreedomSummary, buildIncomeBreakdown } from "@/domain/dashboard/financial-freedom";
import type { DomainTransaction } from "@/domain/types";
import { toDomainTransaction } from "@/lib/transaction-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { FinancialFreedomClient } from "./financial-freedom-client";

export interface FreedomLoaderData {
  transactions: DomainTransaction[];
  totalExpenseFromSummary: number;
}

export async function freedomLoader({ request }: { request: Request }): Promise<FreedomLoaderData> {
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

  const [summary, result] = await Promise.all([
    workerDbClient.getYearlySummary(selectedYear),
    workerDbClient.getAllTransactionsByYear(selectedYear),
  ]);

  const totalExpenseFromSummary = summary.totals.expense / 100;
  const transactions = result.transactions.map((raw) =>
    toDomainTransaction(raw as Record<string, unknown>),
  );

  return { transactions, totalExpenseFromSummary };
}

export default function FreedomPage() {
  const { transactions, totalExpenseFromSummary } = useLoaderData<FreedomLoaderData>();

  const activeIncomeCategories: string[] = [];
  const breakdown = buildIncomeBreakdown(transactions, activeIncomeCategories);
  const totalExpense = totalExpenseFromSummary;
  const summary = buildFreedomSummary(totalExpense, breakdown.passiveIncome);

  const activeByCategoryList = Array.from(breakdown.activeByCategory.entries()).map(
    ([name, amount]) => ({ name, amount }),
  );
  const passiveByCategoryList = Array.from(breakdown.passiveByCategory.entries()).map(
    ([name, amount]) => ({ name, amount }),
  );

  return (
    <AppShell>
      <FinancialFreedomClient
        totalIncome={breakdown.totalIncome}
        activeIncome={breakdown.activeIncome}
        passiveIncome={breakdown.passiveIncome}
        totalExpense={totalExpense}
        summary={summary}
        activeByCategoryList={activeByCategoryList}
        passiveByCategoryList={passiveByCategoryList}
      />
    </AppShell>
  );
}
