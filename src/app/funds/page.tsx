import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import type { DomainProduct, SerializedUnit, UnitDisplayInfo } from "@/domain/types";
import { toDomainProduct, toUnitDisplayInfo } from "@/lib/capital-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { FundsClient } from "./funds-client";

export interface FundsLoaderData {
  serialized: SerializedUnit[];
  products: DomainProduct[];
}

export async function fundsLoader(): Promise<FundsLoaderData> {
  const [unitsResult, productsResult] = await Promise.all([
    workerDbClient.listUnits({ with_products: true }),
    workerDbClient.listProducts(),
  ]);

  const units: UnitDisplayInfo[] = unitsResult.units.map((raw) =>
    toUnitDisplayInfo(raw as Record<string, unknown>),
  );
  const products: DomainProduct[] = productsResult.products.map((raw) =>
    toDomainProduct(raw as Record<string, unknown>),
  );

  const serialized = units.map((u) => ({
    id: u.id,
    unitCode: u.unitCode,
    amount: u.amount,
    currency: u.currency,
    status: u.status,
    strategy: u.strategy,
    tactics: u.tactics,
    productId: u.productId ?? null,
    productName: u.product?.name ?? null,
    latestInvestDate: u.latestInvestDate,
    startDate: u.startDate,
    endDate: u.endDate,
    note: u.note,
    availableDate: u.availableDate,
    availableDateOverride: u.availableDateOverride,
    daysUntilAvailable: u.daysUntilAvailable,
    daysUntilLocked: u.daysUntilLocked,
    isAvailable: u.isAvailable,
  }));

  return { serialized, products };
}

export default function FundsPage() {
  const { serialized, products } = useLoaderData<FundsLoaderData>();

  return (
    <AppShell>
      <FundsClient units={serialized} products={products} />
    </AppShell>
  );
}
