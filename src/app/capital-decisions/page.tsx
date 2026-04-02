import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { toDomainUnit, toUnitDisplayInfo } from "@/lib/capital-mappers"
import {
  classifyDecisions,
  buildDecisionStats,
  buildFilterCounts,
} from "@/domain/assets/capital-decisions"
import { CapitalDecisionsClient } from "./capital-decisions-client"

export default async function CapitalDecisionsPage() {
  let units: ReturnType<typeof toUnitDisplayInfo>[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.listUnits(userId, { with_products: true })
    units = result.units
      .map((raw) => toDomainUnit(raw as Record<string, unknown>))
      .map(toUnitDisplayInfo)
  } catch {
    // Not authenticated or Worker unavailable
  }

  const decisions = classifyDecisions(units)
  const stats = buildDecisionStats(decisions)
  const filterCounts = buildFilterCounts(decisions)

  // Serialize decisions for client
  const serializedDecisions = decisions.map((d) => ({
    unitCode: d.unit.unitCode,
    amount: d.unit.amount,
    currency: d.unit.currency,
    strategy: d.unit.strategy,
    tactics: d.unit.tactics,
    status: d.unit.status,
    productName: d.unit.product?.name ?? null,
    endDate: d.unit.endDate,
    daysUntilMaturity: d.unit.daysUntilMaturity,
    urgency: d.urgency,
    reason: d.reason,
    action: d.details,
  }))

  return (
    <AppShell>
      <CapitalDecisionsClient
        decisions={serializedDecisions}
        stats={{
          totalDecisions: stats.total,
          urgentCount: stats.high,
          soonCount: stats.medium,
          normalCount: stats.low,
          totalAmount: stats.totalAmount,
          urgentAmount: stats.highAmount,
          soonAmount: stats.mediumAmount,
          normalAmount: stats.lowAmount,
        }}
        filterCounts={filterCounts}
      />
    </AppShell>
  )
}
