import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { toUnitDisplayInfo } from "@/lib/capital-mappers"
import type { UnitDisplayInfo } from "@/domain/types"
import { buildStrategyHierarchy, buildTotalAmount } from "@/domain/assets/strategy-sunburst"
import { StrategyClient } from "./strategy-client"

export default async function StrategyPage() {
  let units: UnitDisplayInfo[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.listUnits(userId, { with_products: true })
    units = result.units
      .map((raw) => toUnitDisplayInfo(raw as Record<string, unknown>))
  } catch {
    // Not authenticated or Worker unavailable
  }

  const hierarchy = buildStrategyHierarchy(units, "全部资产")
  const totalAmount = buildTotalAmount(units)

  return (
    <AppShell>
      <StrategyClient
        hierarchy={hierarchy}
        totalAmount={totalAmount}
      />
    </AppShell>
  )
}
