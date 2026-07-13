import { AppShell } from "@/components/layout";
import { getAuthedClient } from "@/lib/api-helpers";
import { toUnitDisplayInfo } from "@/lib/capital-mappers";
import { buildDeploymentRate } from "@/domain/assets/capital-dashboard";
import { CapitalDashboardClient } from "./capital-dashboard-client";

export default async function CapitalDashboardPage() {
  let units: ReturnType<typeof toUnitDisplayInfo>[] = [];

  try {
    const { userId, client } = await getAuthedClient();
    const result = await client.listUnits(userId, { with_products: true });
    units = result.units.map((raw) => toUnitDisplayInfo(raw as Record<string, unknown>));
  } catch {
    // Not authenticated or Worker unavailable
  }

  const deploymentRate = buildDeploymentRate();

  return (
    <AppShell>
      <CapitalDashboardClient units={units} deploymentRate={deploymentRate} />
    </AppShell>
  );
}
