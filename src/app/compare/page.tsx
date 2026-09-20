import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import type { MonthlyData } from "@/domain/types";
import { MONTH_NAMES } from "@/lib/constants";
import { workerDbClient } from "@/lib/worker-db-client";
import { YearComparisonClient } from "./year-comparison-client";

export interface CompareLoaderData {
  yearlyMonthlyData: Record<number, MonthlyData[]>;
  availableYears: number[];
  targetSavingsRate: number;
}

export async function compareLoader(): Promise<CompareLoaderData> {
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

  const availableYears = metadata.years.sort((a, b) => a - b);

  const summaries = await Promise.all(
    availableYears.map(async (year) => {
      const summary = await workerDbClient.getYearlySummary(year);
      return { year, summary };
    }),
  );

  const yearlyMonthlyData: Record<number, MonthlyData[]> = {};
  for (const { year, summary } of summaries) {
    yearlyMonthlyData[year] = summary.months.map((m) => ({
      month: MONTH_NAMES[m.month - 1] ?? `${m.month}月`,
      income: m.income / 100,
      expense: m.expense / 100,
      balance: (m.income - m.expense) / 100,
    }));
  }

  return {
    yearlyMonthlyData,
    availableYears,
    targetSavingsRate,
  };
}

export default function ComparePage() {
  const { yearlyMonthlyData, availableYears, targetSavingsRate } =
    useLoaderData<CompareLoaderData>();

  return (
    <AppShell>
      <YearComparisonClient
        yearlyMonthlyData={yearlyMonthlyData}
        availableYears={availableYears}
        targetSavingsRate={targetSavingsRate}
      />
    </AppShell>
  );
}
