import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { groupAccountsByType } from "@/domain/settings/account-types";
import type { AccountTypeConfig } from "@/domain/types";
import { workerDbClient } from "@/lib/worker-db-client";
import { AccountTypesClient } from "./account-types-client";

export interface AccountTypesLoaderData {
  accounts: string[];
  accountTypes: AccountTypeConfig[];
  grouped: ReturnType<typeof groupAccountsByType>;
}

export async function accountTypesLoader(): Promise<AccountTypesLoaderData> {
  const [metadata, settingsResult] = await Promise.all([
    workerDbClient.getMetadata(),
    workerDbClient.getSettings(),
  ]);

  const accounts = metadata.accounts;
  const row = (settingsResult.settings as Record<string, unknown>) ?? {};
  const rawJson = typeof row.settings === "string" ? row.settings : "{}";
  const parsed = JSON.parse(rawJson) as Record<string, unknown>;
  const accountTypes = (parsed.account_types as AccountTypeConfig[]) ?? [];

  const grouped = groupAccountsByType(accounts, accountTypes);

  return { accounts, accountTypes, grouped };
}

export default function AccountTypesPage() {
  const { accounts, accountTypes, grouped } = useLoaderData<AccountTypesLoaderData>();

  return (
    <AppShell>
      <AccountTypesClient accounts={accounts} accountTypes={accountTypes} grouped={grouped} />
    </AppShell>
  );
}
