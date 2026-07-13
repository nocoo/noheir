import { Suspense } from "react";
import { AppShell } from "@/components/layout";
import type { DomainProduct, UnitDisplayInfo } from "@/domain/types";
import { getAuthedClient } from "@/lib/api-helpers";
import { toDomainProduct, toUnitDisplayInfo } from "@/lib/capital-mappers";
import { ProductsClient } from "./products-client";

export default async function ProductsPage() {
  let products: DomainProduct[] = [];
  let units: UnitDisplayInfo[] = [];

  try {
    const { userId, client } = await getAuthedClient();
    const [productsResult, unitsResult] = await Promise.all([
      // Include archived products for the frontend to filter
      client.listProducts(userId, { includeArchived: true }),
      client.listUnits(userId, { with_products: true }),
    ]);
    products = productsResult.products.map((raw) =>
      toDomainProduct(raw as Record<string, unknown>),
    );
    units = unitsResult.units.map((raw) => toUnitDisplayInfo(raw as Record<string, unknown>));
  } catch {
    // Not authenticated or Worker unavailable
  }

  // Serialize units for client
  const serializedUnits = units.map((u) => ({
    id: u.id,
    unitCode: u.unitCode,
    amount: u.amount,
    currency: u.currency,
    status: u.status,
    strategy: u.strategy,
    tactics: u.tactics,
    productId: u.productId,
    productName: u.product?.name ?? null,
  }));

  return (
    <AppShell>
      <Suspense>
        <ProductsClient products={products} units={serializedUnits} />
      </Suspense>
    </AppShell>
  );
}
