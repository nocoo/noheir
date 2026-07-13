import { AppShell } from "@/components/layout";
import { getAuthedClient } from "@/lib/api-helpers";
import { groupAccountsByType } from "@/domain/settings/account-types";
import type { AccountTypeConfig } from "@/domain/types";
import { AccountTypesClient } from "./account-types-client";

export default async function AccountTypesPage() {
  let accounts: string[] = [];
  let accountTypes: AccountTypeConfig[] = [];

  try {
    const { userId, client } = await getAuthedClient();
    const metadata = await client.getMetadata(userId);
    accounts = metadata.accounts;
    const result = await client.getSettings(userId);
    const row = (result.settings as Record<string, unknown>) ?? {};
    const rawJson = typeof row.settings === "string" ? row.settings : "{}";
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    accountTypes = (parsed.account_types as AccountTypeConfig[]) ?? [];
  } catch {
    // Not authenticated or Worker unavailable
  }

  const grouped = groupAccountsByType(accounts, accountTypes);

  return (
    <AppShell>
      <AccountTypesClient accounts={accounts} accountTypes={accountTypes} grouped={grouped} />
    </AppShell>
  );
}
