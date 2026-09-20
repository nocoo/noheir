import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import type { DomainContributionLog, DomainProduct, DomainUnit } from "@/domain/types";
import { toDomainContributionLog, toDomainProduct, toDomainUnit } from "@/lib/capital-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { CapitalLogsClient } from "./capital-logs-client";

export interface CapitalLogsLoaderData {
  logs: DomainContributionLog[];
  units: DomainUnit[];
  products: DomainProduct[];
}

export async function capitalLogsLoader(): Promise<CapitalLogsLoaderData> {
  const [logsResult, unitsResult, productsResult] = await Promise.all([
    workerDbClient.searchContributionLogs({ limit: 100 }),
    workerDbClient.listUnits({}),
    workerDbClient.listProducts({}),
  ]);

  const logs = logsResult.logs.map((raw) =>
    toDomainContributionLog(raw as Record<string, unknown>),
  );
  const units = unitsResult.units.map((raw) => toDomainUnit(raw as Record<string, unknown>));
  const products = productsResult.products.map((raw) =>
    toDomainProduct(raw as Record<string, unknown>),
  );

  return { logs, units, products };
}

export default function CapitalLogsPage() {
  const { logs, units, products } = useLoaderData<CapitalLogsLoaderData>();

  return (
    <AppShell>
      <CapitalLogsClient logs={logs} units={units} products={products} />
    </AppShell>
  );
}
