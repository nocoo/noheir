import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import { buildDataHealthMetrics, buildDataSummary } from "@/domain/data-management";
import type { DomainTransaction, DomainTransfer } from "@/domain/types";
import { toDomainTransaction, toDomainTransfer } from "@/lib/transaction-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { ManageClient } from "./manage-client";

export interface ManageLoaderData {
  dataSummary: ReturnType<typeof buildDataSummary>;
  healthMetrics: ReturnType<typeof buildDataHealthMetrics>;
}

export async function manageLoader(): Promise<ManageLoaderData> {
  const metadata = await workerDbClient.getMetadata();

  const allTransactions: DomainTransaction[] = [];
  const allTransfers: DomainTransfer[] = [];

  const yearPromises = metadata.years.map(async (year) => {
    const [txResult, trResult] = await Promise.all([
      workerDbClient.getAllTransactionsByYear(year),
      workerDbClient.getAllTransfersByYear(year),
    ]);
    return {
      transactions: txResult.transactions.map((raw) =>
        toDomainTransaction(raw as Record<string, unknown>),
      ),
      transfers: trResult.transfers.map((raw) => toDomainTransfer(raw as Record<string, unknown>)),
    };
  });

  const yearResults = await Promise.all(yearPromises);
  for (const result of yearResults) {
    allTransactions.push(...result.transactions);
    allTransfers.push(...result.transfers);
  }

  const dataSummary = buildDataSummary(allTransactions, allTransfers);
  const healthMetrics = buildDataHealthMetrics(allTransactions);

  return { dataSummary, healthMetrics };
}

export default function ManagePage() {
  const { dataSummary, healthMetrics } = useLoaderData<ManageLoaderData>();

  return (
    <AppShell>
      <ManageClient dataSummary={dataSummary} healthMetrics={healthMetrics} />
    </AppShell>
  );
}
