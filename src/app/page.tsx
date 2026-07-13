import { AppShell } from "@/components/layout";
import { buildSavingsRate } from "@/domain/dashboard/overview";
import type { DomainTransaction, MonthlyData } from "@/domain/types";
import { getAuthedClient } from "@/lib/api-helpers";
import { MONTH_NAMES } from "@/lib/constants";
import { toDomainTransaction } from "@/lib/transaction-mappers";
import { OverviewClient } from "./overview-client";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  let transactions: DomainTransaction[] = [];
  let monthlyData: MonthlyData[] = MONTH_NAMES.map((name) => ({
    month: name,
    income: 0,
    expense: 0,
    balance: 0,
  }));
  let totalIncome = 0;
  let totalExpense = 0;
  let balance = 0;
  let savingsRate = 0;
  let targetSavingsRate = 30;

  try {
    const { userId, client } = await getAuthedClient();
    const metadata = await client.getMetadata(userId);

    const availableYears = metadata.years.sort((a, b) => b - a);

    const yearParam = params.year ? Number(params.year) : null;
    let selectedYear: number;
    if (yearParam && availableYears.includes(yearParam)) {
      selectedYear = yearParam;
    } else {
      selectedYear = availableYears[0] ?? new Date().getFullYear();
    }

    // Fetch aggregated summary + recent 10 transactions + settings in parallel
    const [summary, recentResult, settingsResult] = await Promise.all([
      client.getYearlySummary(userId, selectedYear),
      client.searchTransactions(userId, { year: selectedYear, limit: 10 }),
      client.getSettings(userId),
    ]);

    // Parse settings for targetSavingsRate
    const settingsRow = (settingsResult.settings as Record<string, unknown>) ?? {};
    const rawJson = typeof settingsRow.settings === "string" ? settingsRow.settings : "{}";
    const settingsJson = JSON.parse(rawJson) as Record<string, unknown>;
    if (typeof settingsJson.savings_rate_target === "number") {
      targetSavingsRate = settingsJson.savings_rate_target;
    }

    // Build monthly data from server-side aggregation (amounts in cents → display)
    monthlyData = summary.months.map((m) => ({
      month: MONTH_NAMES[m.month - 1] ?? `${m.month}月`,
      income: m.income / 100,
      expense: m.expense / 100,
      balance: (m.income - m.expense) / 100,
    }));

    totalIncome = summary.totals.income / 100;
    totalExpense = summary.totals.expense / 100;
    balance = totalIncome - totalExpense;
    savingsRate = buildSavingsRate(totalIncome, totalExpense);

    transactions = recentResult.transactions.map((raw) =>
      toDomainTransaction(raw as Record<string, unknown>),
    );
  } catch {
    // Not authenticated or Worker unavailable — render empty state
  }

  return (
    <AppShell>
      <OverviewClient
        transactions={transactions}
        monthlyData={monthlyData}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        balance={balance}
        savingsRate={savingsRate}
        targetSavingsRate={targetSavingsRate}
      />
    </AppShell>
  );
}
