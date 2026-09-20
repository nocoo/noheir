import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { workerDbClient } from "@/lib/worker-db-client";
import { QualityClient } from "./quality-client";

export interface QualityLoaderData {
  metadata: {
    transactionCount: number;
    transferCount: number;
    years: number[];
    accounts: number;
    categories: number;
    currencies: string[];
    tags: string[];
  };
}

export async function qualityLoader(): Promise<QualityLoaderData> {
  const result = await workerDbClient.getMetadata();
  const metadata = {
    transactionCount: result.transaction_count,
    transferCount: result.transfer_count,
    years: result.years,
    accounts: result.accounts.length,
    categories: result.categories.length,
    currencies: result.currencies,
    tags: result.tags,
  };

  return { metadata };
}

export default function QualityPage() {
  const { metadata } = useLoaderData<QualityLoaderData>();

  return (
    <AppShell>
      <QualityClient metadata={metadata} />
    </AppShell>
  );
}
