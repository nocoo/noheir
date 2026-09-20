import { Suspense } from "react";
import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import type { DomainProduct, UnitDisplayInfo } from "@/domain/types";
import { toDomainProduct, toUnitDisplayInfo } from "@/lib/capital-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { ProductsClient } from "./products-client";

export interface ProductsLoaderData {
  products: DomainProduct[];
  serializedUnits: Array<{
    id: string;
    unitCode: string;
    amount: number;
    currency: string;
    status: string;
    strategy: string;
    tactics: string;
    productId: string | null;
    productName: string | null;
  }>;
}

export async function productsLoader(): Promise<ProductsLoaderData> {
  const [productsResult, unitsResult] = await Promise.all([
    workerDbClient.listProducts({ includeArchived: true }),
    workerDbClient.listUnits({ with_products: true }),
  ]);

  const products = productsResult.products.map((raw) =>
    toDomainProduct(raw as Record<string, unknown>),
  );
  const units: UnitDisplayInfo[] = unitsResult.units.map((raw) =>
    toUnitDisplayInfo(raw as Record<string, unknown>),
  );

  const serializedUnits = units.map((u) => ({
    id: u.id,
    unitCode: u.unitCode,
    amount: u.amount,
    currency: u.currency,
    status: u.status,
    strategy: u.strategy,
    tactics: u.tactics,
    productId: u.productId ?? null,
    productName: u.product?.name ?? null,
  }));

  return { products, serializedUnits };
}

export default function ProductsPage() {
  const { products, serializedUnits } = useLoaderData<ProductsLoaderData>();

  return (
    <AppShell>
      <Suspense>
        <ProductsClient products={products} units={serializedUnits} />
      </Suspense>
    </AppShell>
  );
}
