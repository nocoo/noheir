import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction } from "@/domain/types"
import { toDomainTransaction } from "@/lib/transaction-mappers"
import { FlowAnalysisClient } from "./flow-analysis-client"

interface FlowNode {
  source: string
  target: string
  value: number
}

function buildFlowNodes(
  transactions: DomainTransaction[],
  type: "income" | "expense",
): FlowNode[] {
  const filtered = transactions.filter((t) => t.type === type)

  // Build: account → primaryCategory → secondaryCategory flows
  const flowMap = new Map<string, number>()

  for (const t of filtered) {
    // Account → Primary
    const key1 = `${t.account}|||${t.primaryCategory}`
    flowMap.set(key1, (flowMap.get(key1) ?? 0) + t.amount)

    // Primary → Secondary (if exists)
    if (t.secondaryCategory) {
      const key2 = `${t.primaryCategory}|||${t.secondaryCategory}`
      flowMap.set(key2, (flowMap.get(key2) ?? 0) + t.amount)
    }
  }

  return Array.from(flowMap.entries())
    .map(([key, value]) => {
      const [source = "", target = ""] = key.split("|||")
      return { source, target, value }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 50) // Top 50 flows
}

export default async function FlowPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  let transactions: DomainTransaction[] = []
  let selectedYear: number | null = null

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)

    const availableYears = metadata.years.sort((a, b) => b - a)
    const yearParam = params.year ? Number(params.year) : null
    if (yearParam && availableYears.includes(yearParam)) {
      selectedYear = yearParam
    } else {
      selectedYear = availableYears[0] ?? new Date().getFullYear()
    }

    const result = await client.searchTransactions(userId, {
      year: selectedYear,
    })
    transactions = result.transactions.map((raw) =>
      toDomainTransaction(raw as Record<string, unknown>),
    )
  } catch {
    // Not authenticated or Worker unavailable
  }

  const incomeFlows = buildFlowNodes(transactions, "income")
  const expenseFlows = buildFlowNodes(transactions, "expense")

  return (
    <AppShell>
      <FlowAnalysisClient
        incomeFlows={incomeFlows}
        expenseFlows={expenseFlows}
      />
    </AppShell>
  )
}
