import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import {
  buildMonthlyAvailability,
  buildSeries,
  buildSummaryStats,
  buildUpcomingUnits,
} from "@/domain/assets/liquidity-ladder";
import type { UnitDisplayInfo } from "@/domain/types";
import { toUnitDisplayInfo } from "@/lib/capital-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { LiquidityClient } from "./liquidity-client";

export interface LiquidityLoaderData {
  chartData: Array<Record<string, string | number>>;
  strategies: string[];
  total12m: number;
  avgMonth: number;
  peakMonth: string;
  peakAmount: number;
  upcomingUnits: ReturnType<typeof buildUpcomingUnits>;
}

export async function liquidityLoader(): Promise<LiquidityLoaderData> {
  const result = await workerDbClient.listUnits({ with_products: true });
  const units: UnitDisplayInfo[] = result.units.map((raw) =>
    toUnitDisplayInfo(raw as Record<string, unknown>),
  );

  const monthlyData = buildMonthlyAvailability(units);
  const series = buildSeries(monthlyData);
  const summaryStats = buildSummaryStats(monthlyData);
  const upcomingUnits = buildUpcomingUnits(units);

  const chartData = monthlyData.months.map((month, i) => {
    const monthLabel =
      monthlyData.monthlyAvailability.find((m) => m.month === month)?.monthLabel ?? month;
    const row: Record<string, string | number> = { month: monthLabel };
    series.forEach((s) => {
      row[s.name] = s.data[i] ?? 0;
    });
    return row;
  });

  return {
    chartData,
    strategies: monthlyData.strategies,
    total12m: summaryStats.total,
    avgMonth: summaryStats.avgMonth,
    peakMonth: summaryStats.peakMonth.month,
    peakAmount: summaryStats.peakMonth.amount,
    upcomingUnits,
  };
}

export default function LiquidityPage() {
  const { chartData, strategies, total12m, avgMonth, peakMonth, peakAmount, upcomingUnits } =
    useLoaderData<LiquidityLoaderData>();

  return (
    <AppShell>
      <LiquidityClient
        chartData={chartData}
        strategies={strategies}
        total12m={total12m}
        avgMonth={avgMonth}
        peakMonth={peakMonth}
        peakAmount={peakAmount}
        upcomingUnits={upcomingUnits}
      />
    </AppShell>
  );
}
