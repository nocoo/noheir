import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { groupAccountsByType } from "@/domain/settings/account-types";
import type { AccountTypeConfig } from "@/domain/types";
import { financeApi } from "@/lib/finance-api";
import { workerDbClient } from "@/lib/worker-db-client";
import { AccountTypesClient } from "./account-types-client";

export interface AccountTypesLoaderData {
  accounts: string[];
  revision: number;
  accountTypes: AccountTypeConfig[];
  grouped: ReturnType<typeof groupAccountsByType>;
}

export async function accountTypesLoader(): Promise<AccountTypesLoaderData> {
  const [metadata, settingsResult] = await Promise.all([
    workerDbClient.getMetadata(),
    financeApi.listAccountClassifications(),
  ]);

  const accounts = metadata.accounts;
  const accountTypes = settingsResult.data.map(({ accountName, type }) => ({ accountName, type }));
  const revision = settingsResult.meta.dataRevision;
  if (revision === undefined) throw new Error("Missing financial data revision");

  const grouped = groupAccountsByType(accounts, accountTypes);

  return { accounts, accountTypes, grouped, revision };
}

export default function AccountTypesPage() {
  const { accounts, accountTypes, grouped, revision } = useLoaderData<AccountTypesLoaderData>();

  return (
    <AppShell>
      <AccountTypesClient
        revision={revision}
        accounts={accounts}
        accountTypes={accountTypes}
        grouped={grouped}
      />
    </AppShell>
  );
}
