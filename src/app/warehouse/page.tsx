import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { toDomainUnit, toUnitDisplayInfo } from "@/lib/capital-mappers"
import type { UnitDisplayInfo } from "@/domain/types"
import { WarehouseClient } from "./warehouse-client"

export default async function WarehousePage() {
  let units: UnitDisplayInfo[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.listUnits(userId, { with_products: true })
    units = result.units
      .map((raw) => toDomainUnit(raw as Record<string, unknown>))
      .map(toUnitDisplayInfo)
  } catch {
    // Not authenticated or Worker unavailable
  }

  const serialized = units.map((u) => ({
    id: u.id,
    unitCode: u.unitCode,
    amount: u.amount,
    currency: u.currency,
    status: u.status,
    strategy: u.strategy,
    tactics: u.tactics,
    productName: u.product?.name ?? null,
    startDate: u.startDate,
    endDate: u.endDate,
    daysUntilMaturity: u.daysUntilMaturity,
    isAvailable: u.isAvailable,
  }))

  return (
    <AppShell>
      <WarehouseClient units={serialized} />
    </AppShell>
  )
}
