import { useLoaderData } from "react-router";
import { AppShell } from "@/components/layout";
import type { AccountSummary } from "@/domain/dashboard/account-analysis";
import {
  buildAccountGroups,
  buildChartData,
  buildPieData,
} from "@/domain/dashboard/account-analysis";
import { workerDbClient } from "@/lib/worker-db-client";
import { AccountAnalysisClient } from "./account-analysis-client";

export interface AccountLoaderData {
  serializedAccounts: Array<{
    name: string;
    income: number;
    expense: number;
    balance: number;
    transactionCount: number;
  }>;
  serializedGroups: Array<{
    prefix: string;
    totalIncome: number;
    totalExpense: number;
    totalBalance: number;
    totalTransactions: number;
    accountType?: import("@/domain/types").AccountType | undefined;
    accounts: Array<{
      name: string;
      income: number;
      expense: number;
      balance: number;
      transactionCount: number;
    }>;
  }>;
  chartData: ReturnType<typeof buildChartData>;
  pieData: ReturnType<typeof buildPieData>;
  summaryStats: {
    accountCount: number;
    totalTransactions: number;
    totalFlow: number;
    totalIncome: number;
    totalExpense: number;
  };
}

export async function accountLoader({ request }: { request: Request }): Promise<AccountLoaderData> {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");

  const metadata = await workerDbClient.getMetadata();
  const availableYears = metadata.years.sort((a, b) => b - a);
  const parsedYear = yearParam ? Number(yearParam) : null;
  let selectedYear: number;
  if (parsedYear && availableYears.includes(parsedYear)) {
    selectedYear = parsedYear;
  } else {
    selectedYear = availableYears[0] ?? new Date().getFullYear();
  }

  const accountSummary = await workerDbClient.getAccountSummary(selectedYear);

  let totalTransactions = 0;
  let totalFlow = 0;
  const accountMap = new Map<string, AccountSummary>();

  for (const row of accountSummary.accounts) {
    if (!accountMap.has(row.account)) {
      accountMap.set(row.account, {
        name: row.account,
        income: 0,
        expense: 0,
        balance: 0,
        transactionCount: 0,
        categories: new Map(),
      });
    }
    const acc = accountMap.get(row.account);
    if (!acc) continue;
    const amount = row.total / 100;

    if (row.type === "income") {
      acc.income += amount;
    } else {
      acc.expense += amount;
    }
    acc.balance = acc.income - acc.expense;
    acc.transactionCount += row.count;

    totalTransactions += row.count;
    totalFlow += amount;
  }

  const accountData = Array.from(accountMap.values()).sort(
    (a, b) => b.income + b.expense - (a.income + a.expense),
  );

  const accountGroups = buildAccountGroups(accountData, "prefix");
  const chartData = buildChartData(accountData);
  const pieData = buildPieData(accountData);

  const totalIncome = accountData.reduce((sum, acc) => sum + acc.income, 0);
  const totalExpense = accountData.reduce((sum, acc) => sum + acc.expense, 0);

  const summaryStats = {
    accountCount: accountData.length,
    totalTransactions,
    totalFlow,
    totalIncome,
    totalExpense,
  };

  const serializedAccounts = accountData.map((a) => ({
    name: a.name,
    income: a.income,
    expense: a.expense,
    balance: a.balance,
    transactionCount: a.transactionCount,
  }));

  const serializedGroups = accountGroups.map((g) => ({
    prefix: g.prefix,
    totalIncome: g.totalIncome,
    totalExpense: g.totalExpense,
    totalBalance: g.totalBalance,
    totalTransactions: g.totalTransactions,
    accountType: g.accountType,
    accounts: g.accounts.map((a) => ({
      name: a.name,
      income: a.income,
      expense: a.expense,
      balance: a.balance,
      transactionCount: a.transactionCount,
    })),
  }));

  return {
    serializedAccounts,
    serializedGroups,
    chartData,
    pieData,
    summaryStats,
  };
}

export default function AccountPage() {
  const { serializedAccounts, serializedGroups, chartData, pieData, summaryStats } =
    useLoaderData<AccountLoaderData>();

  return (
    <AppShell>
      <AccountAnalysisClient
        accounts={serializedAccounts}
        accountGroups={serializedGroups}
        chartData={chartData}
        pieData={pieData}
        summaryStats={summaryStats}
      />
    </AppShell>
  );
}
