import { useLoaderData } from "react-router";
import type { BalanceAnchor } from "@/domain/types";
import { financeApi } from "@/lib/finance-api";
import { workerDbClient } from "@/lib/worker-db-client";
import { BalanceAnchorsClient } from "./balance-anchors-client";

export interface BalanceAnchorsLoaderData {
  accounts: string[];
  revision: number;
  anchors: BalanceAnchor[];
}

export async function balanceAnchorsLoader(): Promise<BalanceAnchorsLoaderData> {
  const [metadata, settingsResult] = await Promise.all([
    workerDbClient.getMetadata(),
    financeApi.listBalanceAnchors(),
  ]);

  const accounts = metadata.accounts.sort();
  const anchors = settingsResult.data.map(({ accountName, date, balanceCents, currency }) => ({
    accountName,
    date,
    balance: balanceCents / 100,
    currency,
  }));
  const revision = settingsResult.meta.dataRevision;
  if (revision === undefined) throw new Error("Missing financial data revision");

  return { accounts, anchors, revision };
}

export default function BalanceAnchorsPage() {
  const { accounts, anchors, revision } = useLoaderData<BalanceAnchorsLoaderData>();

  return <BalanceAnchorsClient revision={revision} accounts={accounts} initialAnchors={anchors} />;
}
