import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { DomainTransaction, DomainTransfer } from "@/domain/types"
import { toDomainTransaction, parseTags } from "@/lib/transaction-mappers"
import {
  buildBalanceEntries,
  buildUniqueAccounts,
  buildAccountDetailData,
} from "@/domain/dashboard/account-detail"
import { AccountDetailClient } from "./account-detail-client"

function toDomainTransfer(raw: Record<string, unknown>): DomainTransfer {
  return {
    id: String(raw.id ?? ""),
    date: String(raw.date ?? ""),
    year: Number(raw.year ?? 0),
    month: Number(raw.month ?? 0),
    day: Number(raw.day ?? 0),
    primaryCategory: raw.primaryCategory != null ? String(raw.primaryCategory) : null,
    secondaryCategory: raw.secondaryCategory != null ? String(raw.secondaryCategory) : null,
    transactionType: raw.transactionType != null ? String(raw.transactionType) : null,
    inflowAmount: Number(raw.inflowAmountCents ?? 0) / 100,
    outflowAmount: Number(raw.outflowAmountCents ?? 0) / 100,
    currency: String(raw.currency ?? "CNY"),
    account: String(raw.account ?? ""),
    tags: parseTags(raw.tags),
    note: raw.note != null ? String(raw.note) : null,
  }
}

export default async function AccountDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; account?: string }>
}) {
  const params = await searchParams
  let transactions: DomainTransaction[] = []
  let transfers: DomainTransfer[] = []
  let selectedYear: number | null = null

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)

    const availableYears = metadata.years.sort((a, b) => b - a)
    const yearParam = params.year ? Number(params.year) : null
    if (yearParam && availableYears.includes(yearParam)) {
      selectedYear = yearParam
    } else {
      selectedYear = availableYears[0] ?? new Date().getFullYear()
    }

    const [txResult, trResult] = await Promise.all([
      client.getAllTransactionsByYear(userId, selectedYear),
      client.getAllTransfersByYear(userId, selectedYear),
    ])

    transactions = txResult.transactions.map((raw) =>
      toDomainTransaction(raw as Record<string, unknown>),
    )
    transfers = trResult.transfers.map((raw: unknown) =>
      toDomainTransfer(raw as Record<string, unknown>),
    )
  } catch {
    // Not authenticated or Worker unavailable
  }

  const entries = buildBalanceEntries(transactions, transfers)
  const uniqueAccounts = buildUniqueAccounts(entries)
  const selectedAccount = params.account ?? uniqueAccounts[0] ?? ""

  const detailData =
    selectedAccount && selectedYear
      ? buildAccountDetailData(entries, selectedAccount, selectedYear)
      : null

  // Serialize for client
  const serializedDailyBalances = detailData?.dailyBalances ?? []
  const serializedEntries = (detailData?.displayEntries ?? []).map((e) => ({
    id: e.id,
    date: e.date,
    primaryCategory: e.primaryCategory,
    secondaryCategory: e.secondaryCategory,
    tertiaryCategory: e.tertiaryCategory,
    type: e.type,
    amount: e.amount,
    balance: e.balance,
    balanceAfter: e.balanceAfter,
    note: e.note,
    isAnchor: e.isAnchor,
  }))
  const serializedSummary = detailData?.summary ?? {
    totalIncome: 0,
    totalExpense: 0,
    initialBalance: 0,
    finalBalance: 0,
    hasAnchor: false,
    transactionCount: 0,
  }

  return (
    <AppShell>
      <AccountDetailClient
        uniqueAccounts={uniqueAccounts}
        selectedAccount={selectedAccount}
        dailyBalances={serializedDailyBalances}
        displayEntries={serializedEntries}
        summary={serializedSummary}
      />
    </AppShell>
  )
}
