import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { buildDeploymentRate } from "@/domain/assets/capital-dashboard";
import { toUnitDisplayInfo } from "@/lib/capital-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { CapitalDashboardClient } from "./capital-dashboard-client";

export interface CapitalDashboardLoaderData {
  units: ReturnType<typeof toUnitDisplayInfo>[];
  deploymentRate: ReturnType<typeof buildDeploymentRate>;
}

export async function capitalDashboardLoader(): Promise<CapitalDashboardLoaderData> {
  const result = await workerDbClient.listUnits({ with_products: true });
  const units = result.units.map((raw) => toUnitDisplayInfo(raw as Record<string, unknown>));
  const deploymentRate = buildDeploymentRate();

  return { units, deploymentRate };
}

export default function CapitalDashboardPage() {
  const { units, deploymentRate } = useLoaderData<CapitalDashboardLoaderData>();

  return (
    <AppShell>
      <CapitalDashboardClient units={units} deploymentRate={deploymentRate} />
    </AppShell>
  );
}
