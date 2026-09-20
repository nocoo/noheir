import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import type { BalanceAnchor } from "@/domain/types";
import { workerDbClient } from "@/lib/worker-db-client";
import { BalanceAnchorsClient } from "./balance-anchors-client";

export interface BalanceAnchorsLoaderData {
  accounts: string[];
  anchors: BalanceAnchor[];
}

export async function balanceAnchorsLoader(): Promise<BalanceAnchorsLoaderData> {
  const [metadata, settingsResult] = await Promise.all([
    workerDbClient.getMetadata(),
    workerDbClient.getSettings(),
  ]);

  const accounts = metadata.accounts.sort();
  const row = (settingsResult.settings as Record<string, unknown>) ?? {};
  const rawJson = typeof row.settings === "string" ? row.settings : "{}";
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;

  const anchors = Array.isArray(parsed.balance_anchors) ? parsed.balance_anchors : [];

  return { accounts, anchors };
}

export default function BalanceAnchorsPage() {
  const { accounts, anchors } = useLoaderData<BalanceAnchorsLoaderData>();

  return (
    <AppShell>
      <BalanceAnchorsClient accounts={accounts} initialAnchors={anchors} />
    </AppShell>
  );
}
