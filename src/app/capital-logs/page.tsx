import { AppShell } from "@/components/layout";
import type { DomainContributionLog, DomainProduct, DomainUnit } from "@/domain/types";
import { getAuthedClient } from "@/lib/api-helpers";
import { toDomainContributionLog, toDomainProduct, toDomainUnit } from "@/lib/capital-mappers";
import { CapitalLogsClient } from "./capital-logs-client";

export default async function CapitalLogsPage() {
  let logs: DomainContributionLog[] = [];
  let units: DomainUnit[] = [];
  let products: DomainProduct[] = [];

  try {
    const { userId, client } = await getAuthedClient();

    const [logsResult, unitsResult, productsResult] = await Promise.all([
      client.searchContributionLogs(userId, { limit: 100 }),
      client.listUnits(userId, {}),
      client.listProducts(userId, {}),
    ]);

    logs = logsResult.logs.map((raw) => toDomainContributionLog(raw as Record<string, unknown>));
    units = unitsResult.units.map((raw) => toDomainUnit(raw as Record<string, unknown>));
    products = productsResult.products.map((raw) =>
      toDomainProduct(raw as Record<string, unknown>),
    );
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <CapitalLogsClient logs={logs} units={units} products={products} />
    </AppShell>
  );
}
