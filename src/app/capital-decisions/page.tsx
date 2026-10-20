import { useLoaderData } from "react-router";
import {
  buildDecisionStats,
  buildFilterCounts,
  classifyDecisions,
} from "@/domain/assets/capital-decisions";
import { toUnitDisplayInfo } from "@/lib/capital-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { CapitalDecisionsClient } from "./capital-decisions-client";

export interface CapitalDecisionsLoaderData {
  serializedDecisions: Array<{
    unitCode: string;
    amount: number;
    currency: string;
    strategy: string;
    tactics: string;
    status: string;
    productName: string | null;
    availableDate: string | null;
    daysUntilAvailable?: number | null;
    urgency: string;
    reason: string;
    action: string;
  }>;
  stats: {
    totalDecisions: number;
    urgentCount: number;
    soonCount: number;
    normalCount: number;
    totalAmount: number;
    urgentAmount: number;
    soonAmount: number;
    normalAmount: number;
  };
  filterCounts: ReturnType<typeof buildFilterCounts>;
}

export async function capitalDecisionsLoader(): Promise<CapitalDecisionsLoaderData> {
  const result = await workerDbClient.listUnits({ with_products: true });
  const units = result.units.map((raw) => toUnitDisplayInfo(raw as Record<string, unknown>));

  const decisions = classifyDecisions(units);
  const stats = buildDecisionStats(decisions);
  const cnyStats = buildDecisionStats(
    decisions.filter((decision) => decision.unit.currency === "CNY"),
  );
  const filterCounts = buildFilterCounts(decisions);

  const serializedDecisions = decisions.map((d) => ({
    unitCode: d.unit.unitCode,
    amount: d.unit.amount,
    currency: d.unit.currency,
    strategy: d.unit.strategy,
    tactics: d.unit.tactics,
    status: d.unit.status,
    productName: d.unit.product?.name ?? null,
    availableDate: d.unit.availableDate,
    daysUntilAvailable: d.unit.daysUntilAvailable,
    urgency: d.urgency,
    reason: d.reason,
    action: d.details,
  }));

  return {
    serializedDecisions,
    stats: {
      totalDecisions: stats.total,
      urgentCount: stats.high,
      soonCount: stats.medium,
      normalCount: stats.low,
      totalAmount: cnyStats.totalAmount,
      urgentAmount: cnyStats.highAmount,
      soonAmount: cnyStats.mediumAmount,
      normalAmount: cnyStats.lowAmount,
    },
    filterCounts,
  };
}

export default function CapitalDecisionsPage() {
  const { serializedDecisions, stats, filterCounts } = useLoaderData<CapitalDecisionsLoaderData>();

  return (
    <CapitalDecisionsClient
      decisions={serializedDecisions}
      stats={stats}
      filterCounts={filterCounts}
    />
  );
}
