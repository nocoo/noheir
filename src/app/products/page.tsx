import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { toDomainProduct } from "@/lib/capital-mappers"
import type { DomainProduct } from "@/domain/types"
import { ProductsClient } from "./products-client"

export default async function ProductsPage() {
  let products: DomainProduct[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.listProducts(userId)
    products = result.products.map((raw) =>
      toDomainProduct(raw as Record<string, unknown>),
    )
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <ProductsClient products={products} />
    </AppShell>
  )
}
