import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { toDomainProduct, toUnitDisplayInfo } from "@/lib/capital-mappers"
import type { UnitDisplayInfo, DomainProduct } from "@/domain/types"
import { WarehouseClient } from "./warehouse-client"

export default async function WarehousePage() {
  let units: UnitDisplayInfo[] = []
  let products: DomainProduct[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const [unitsResult, productsResult] = await Promise.all([
      client.listUnits(userId, { with_products: true }),
      client.listProducts(userId),
    ])
    units = unitsResult.units
      .map((raw) => toUnitDisplayInfo(raw as Record<string, unknown>))
    products = productsResult.products.map((raw) =>
      toDomainProduct(raw as Record<string, unknown>),
    )
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
    productId: u.productId,
    productName: u.product?.name ?? null,
    productChannel: u.product?.channel ?? null,
    startDate: u.startDate,
    endDate: u.endDate,
    note: u.note,
    availableDate: u.availableDate,
    daysUntilAvailable: u.daysUntilAvailable,
    isAvailable: u.isAvailable,
  }))

  return (
    <AppShell>
      <WarehouseClient units={serialized} products={products} />
    </AppShell>
  )
}
