import { AppShell } from "@/components/layout";
import { getAuthedClient } from "@/lib/api-helpers";
import { FlowAnalysisClient } from "./flow-analysis-client";

interface FlowNode {
  source: string;
  target: string;
  value: number;
}

export default async function FlowPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  let incomeFlows: FlowNode[] = [];
  let expenseFlows: FlowNode[] = [];

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

    const flowData = await client.getFlowSummary(userId, selectedYear);

    // Build flow nodes from server-side aggregation (cents → display)
    const buildFlows = (type: "income" | "expense"): FlowNode[] => {
      const flowMap = new Map<string, number>();

      // Account → Primary Category
      for (const row of flowData.account_to_category) {
        if (row.type !== type) continue;
        const key = `${row.account}|||${row.primary_category}`;
        flowMap.set(key, (flowMap.get(key) ?? 0) + row.total);
      }

      // Primary → Secondary Category
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

    incomeFlows = buildFlows("income");
    expenseFlows = buildFlows("expense");
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <FlowAnalysisClient incomeFlows={incomeFlows} expenseFlows={expenseFlows} />
    </AppShell>
  );
}
