import { AppShell } from "@/components/layout";
import { getAuthedClient } from "@/lib/api-helpers";
import { QualityClient } from "./quality-client";

export default async function QualityPage() {
  let metadata = {
    transactionCount: 0,
    transferCount: 0,
    years: [] as number[],
    accounts: 0,
    categories: 0,
    currencies: [] as string[],
    tags: [] as string[],
  };

  try {
    const { userId, client } = await getAuthedClient();
    const result = await client.getMetadata(userId);
    metadata = {
      transactionCount: result.transaction_count,
      transferCount: result.transfer_count,
      years: result.years,
      accounts: result.accounts.length,
      categories: result.categories.length,
      currencies: result.currencies,
      tags: result.tags,
    };
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <QualityClient metadata={metadata} />
    </AppShell>
  );
}
