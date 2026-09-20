import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { buildStrategyHierarchy, buildTotalAmount } from "@/domain/assets/strategy-sunburst";
import type { UnitDisplayInfo } from "@/domain/types";
import { toUnitDisplayInfo } from "@/lib/capital-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { StrategyClient } from "./strategy-client";

export interface StrategyLoaderData {
  hierarchy: ReturnType<typeof buildStrategyHierarchy>;
  totalAmount: number;
}

export async function strategyLoader(): Promise<StrategyLoaderData> {
  const result = await workerDbClient.listUnits({ with_products: true });
  const units: UnitDisplayInfo[] = result.units.map((raw) =>
    toUnitDisplayInfo(raw as Record<string, unknown>),
  );

  const hierarchy = buildStrategyHierarchy(units, "全部资产");
  const totalAmount = buildTotalAmount(units);

  return { hierarchy, totalAmount };
}

export default function StrategyPage() {
  const { hierarchy, totalAmount } = useLoaderData<StrategyLoaderData>();

  return (
    <AppShell>
      <StrategyClient hierarchy={hierarchy} totalAmount={totalAmount} />
    </AppShell>
  );
}
