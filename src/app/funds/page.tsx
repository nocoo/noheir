import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { toDomainUnit, toDomainProduct, toUnitDisplayInfo } from "@/lib/capital-mappers"
import type { UnitDisplayInfo, DomainProduct } from "@/domain/types"
import { FundsClient } from "./funds-client"

export default async function FundsPage() {
  let units: UnitDisplayInfo[] = []
  let products: DomainProduct[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const [unitsResult, productsResult] = await Promise.all([
      client.listUnits(userId, { with_products: true }),
      client.listProducts(userId),
    ])
    units = unitsResult.units
      .map((raw) => toDomainUnit(raw as Record<string, unknown>))
      .map(toUnitDisplayInfo)
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
    startDate: u.startDate,
    endDate: u.endDate,
    note: u.note,
    daysUntilMaturity: u.daysUntilMaturity,
    isAvailable: u.isAvailable,
  }))

  return (
    <AppShell>
      <FundsClient units={serialized} products={products} />
    </AppShell>
  )
}
