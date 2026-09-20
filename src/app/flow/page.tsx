import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { workerDbClient } from "@/lib/worker-db-client";
import { FlowAnalysisClient } from "./flow-analysis-client";

interface FlowNode {
  source: string;
  target: string;
  value: number;
}

export interface FlowLoaderData {
  incomeFlows: FlowNode[];
  expenseFlows: FlowNode[];
}

export async function flowLoader({ request }: { request: Request }): Promise<FlowLoaderData> {
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

  const flowData = await workerDbClient.getFlowSummary(selectedYear);

  const buildFlows = (type: "income" | "expense"): FlowNode[] => {
    const flowMap = new Map<string, number>();

    for (const row of flowData.account_to_category) {
      if (row.type !== type) continue;
      const key = `${row.account}|||${row.primary_category}`;
      flowMap.set(key, (flowMap.get(key) ?? 0) + row.total);
    }

    for (const row of flowData.category_to_subcategory) {
      if (row.type !== type) continue;
      if (!row.secondary_category) continue;
      const key = `${row.primary_category}|||${row.secondary_category}`;
      flowMap.set(key, (flowMap.get(key) ?? 0) + row.total);
    }

    return Array.from(flowMap.entries())
      .map(([key, value]) => {
        const [source = "", target = ""] = key.split("|||");
        return { source, target, value: value / 100 };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);
  };

  const incomeFlows = buildFlows("income");
  const expenseFlows = buildFlows("expense");

  return { incomeFlows, expenseFlows };
}

export default function FlowPage() {
  const { incomeFlows, expenseFlows } = useLoaderData<FlowLoaderData>();

  return (
    <AppShell>
      <FlowAnalysisClient incomeFlows={incomeFlows} expenseFlows={expenseFlows} />
    </AppShell>
  );
}
