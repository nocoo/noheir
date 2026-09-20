import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import {
  buildSavingsRateChartData,
  buildSavingsRateSummary,
} from "@/domain/dashboard/savings-rate";
import type { MonthlyData } from "@/domain/types";
import { MONTH_NAMES } from "@/lib/constants";
import { workerDbClient } from "@/lib/worker-db-client";
import { SavingsRateClient } from "./savings-rate-client";

export interface SavingsLoaderData {
  monthlyData: MonthlyData[];
  targetSavingsRate: number;
}

export async function savingsLoader({ request }: { request: Request }): Promise<SavingsLoaderData> {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  const [metadata, settingsResult] = await Promise.all([
    workerDbClient.getMetadata(),
    workerDbClient.getSettings(),
  ]);

  let targetSavingsRate = 30;
  const settingsRow = (settingsResult.settings as Record<string, unknown>) ?? {};
  const rawJson = typeof settingsRow.settings === "string" ? settingsRow.settings : "{}";
  const settingsJson = JSON.parse(rawJson) as Record<string, unknown>;
  if (typeof settingsJson.savings_rate_target === "number") {
    targetSavingsRate = settingsJson.savings_rate_target;
  }

  const availableYears = metadata.years.sort((a, b) => b - a);
  const parsedYear = yearParam ? Number(yearParam) : null;
  let selectedYear: number;
  if (parsedYear && availableYears.includes(parsedYear)) {
    selectedYear = parsedYear;
  } else {
    selectedYear = availableYears[0] ?? new Date().getFullYear();
  }

  const summary = await workerDbClient.getYearlySummary(selectedYear);

  const monthlyData: MonthlyData[] = summary.months.map((m) => ({
    month: MONTH_NAMES[m.month - 1] ?? `${m.month}月`,
    income: m.income / 100,
    expense: m.expense / 100,
    balance: (m.income - m.expense) / 100,
  }));

  return { monthlyData, targetSavingsRate };
}

export default function SavingsPage() {
  const { monthlyData, targetSavingsRate } = useLoaderData<SavingsLoaderData>();

  const { chartData, totals } = buildSavingsRateChartData(monthlyData);
  const summary = buildSavingsRateSummary(totals, targetSavingsRate);

  return (
    <AppShell>
      <SavingsRateClient
        chartData={chartData}
        summary={summary}
        targetSavingsRate={targetSavingsRate}
      />
    </AppShell>
  );
}
