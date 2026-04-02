import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { ManageClient } from "./manage-client"
import type { DomainTransaction, DomainTransfer } from "@/domain/types"
import { buildDataSummary, buildDataHealthMetrics } from "@/domain/data-management"
import { toDomainTransaction, toDomainTransfer } from "@/lib/transaction-mappers"

export default async function ManagePage() {
  let dataSummary = {
    totalTransactions: 0,
    totalTransfers: 0,
    years: [] as number[],
    yearlyStats: [] as ReturnType<typeof buildDataSummary>["yearlyStats"],
    totalIncome: 0,
    totalExpense: 0,
    totalNetAmount: 0,
    totalAccounts: [] as string[],
    totalCategories: [] as string[],
  }
  let healthMetrics = buildDataHealthMetrics([])

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)

    // Fetch all transactions and transfers for each year to build detailed stats
    const allTransactions: DomainTransaction[] = []
    const allTransfers: DomainTransfer[] = []

    // Fetch data for each year in parallel
    const yearPromises = metadata.years.map(async (year) => {
      const [txResult, trResult] = await Promise.all([
        client.getAllTransactionsByYear(userId, year),
        client.getAllTransfersByYear(userId, year),
      ])
      return {
        transactions: txResult.transactions.map((raw) =>
          toDomainTransaction(raw as Record<string, unknown>),
        ),
        transfers: trResult.transfers.map((raw) =>
          toDomainTransfer(raw as Record<string, unknown>),
        ),
      }
    })

    const yearResults = await Promise.all(yearPromises)
    for (const result of yearResults) {
      allTransactions.push(...result.transactions)
      allTransfers.push(...result.transfers)
    }

    // Build comprehensive summary
    dataSummary = buildDataSummary(allTransactions, allTransfers)
    healthMetrics = buildDataHealthMetrics(allTransactions)
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <ManageClient dataSummary={dataSummary} healthMetrics={healthMetrics} />
    </AppShell>
  )
}
