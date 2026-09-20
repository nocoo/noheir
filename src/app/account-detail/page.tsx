import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import {
  buildAccountDetailData,
  buildBalanceEntries,
  buildUniqueAccounts,
  type DailyBalance,
  type DisplayEntry,
} from "@/domain/dashboard/account-detail";
import type { DomainTransfer } from "@/domain/types";
import { parseTags, toDomainTransaction } from "@/lib/transaction-mappers";
import { workerDbClient } from "@/lib/worker-db-client";
import { AccountDetailClient } from "./account-detail-client";

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
  };
}

export interface AccountDetailLoaderData {
  uniqueAccounts: string[];
  selectedAccount: string;
  dailyBalances: DailyBalance[];
  displayEntries: DisplayEntry[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    initialBalance: number;
    finalBalance: number;
    hasAnchor: boolean;
    transactionCount: number;
  };
}

export async function accountDetailLoader({
  request,
}: {
  request: Request;
}): Promise<AccountDetailLoaderData> {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const accountParam = url.searchParams.get("account");

  const metadata = await workerDbClient.getMetadata();
  const availableYears = metadata.years.sort((a, b) => b - a);
  const parsedYear = yearParam ? Number(yearParam) : null;
  let selectedYear: number;
  if (parsedYear && availableYears.includes(parsedYear)) {
    selectedYear = parsedYear;
  } else {
    selectedYear = availableYears[0] ?? new Date().getFullYear();
  }

  const [txResult, trResult] = await Promise.all([
    workerDbClient.getAllTransactionsByYear(selectedYear),
    workerDbClient.getAllTransfersByYear(selectedYear),
  ]);

  const transactions = txResult.transactions.map((raw) =>
    toDomainTransaction(raw as Record<string, unknown>),
  );
  const transfers = trResult.transfers.map((raw: unknown) =>
    toDomainTransfer(raw as Record<string, unknown>),
  );

  const entries = buildBalanceEntries(transactions, transfers);
  const uniqueAccounts = buildUniqueAccounts(entries);
  const selectedAccount = accountParam ?? uniqueAccounts[0] ?? "";

  const detailData =
    selectedAccount && selectedYear
      ? buildAccountDetailData(entries, selectedAccount, selectedYear)
      : null;

  const dailyBalances = detailData?.dailyBalances ?? [];
  const displayEntries = detailData?.displayEntries ?? [];
  const summary = detailData?.summary ?? {
    totalIncome: 0,
    totalExpense: 0,
    initialBalance: 0,
    finalBalance: 0,
    hasAnchor: false,
    transactionCount: 0,
  };

  return {
    uniqueAccounts,
    selectedAccount,
    dailyBalances,
    displayEntries,
    summary,
  };
}

export default function AccountDetailPage() {
  const { uniqueAccounts, selectedAccount, dailyBalances, displayEntries, summary } =
    useLoaderData<AccountDetailLoaderData>();

  return (
    <AppShell>
      <AccountDetailClient
        uniqueAccounts={uniqueAccounts}
        selectedAccount={selectedAccount}
        dailyBalances={dailyBalances}
        displayEntries={displayEntries}
        summary={summary}
      />
    </AppShell>
  );
}
