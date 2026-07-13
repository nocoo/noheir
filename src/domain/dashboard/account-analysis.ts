import type { AccountType, AccountTypeConfig, DomainTransaction } from "../types";

export interface AccountSummary {
  name: string;
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
  categories: Map<string, number>;
}

export interface AccountGroup {
  prefix: string;
  accounts: AccountSummary[];
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  totalTransactions: number;
  accountType?: AccountType;
}

export type GroupByType = "prefix" | "type";

export const getAccountPrefix = (accountName: string): string => {
  const hyphenIndex = accountName.indexOf("-");
  if (hyphenIndex > 0) {
    return accountName.substring(0, hyphenIndex).trim();
  }
  return accountName;
};

export const buildAccountData = (transactions: DomainTransaction[]): AccountSummary[] => {
  const accountMap = new Map<string, AccountSummary>();

  for (const t of transactions) {
    if (!accountMap.has(t.account)) {
      accountMap.set(t.account, {
        name: t.account,
        income: 0,
        expense: 0,
        balance: 0,
        transactionCount: 0,
        categories: new Map(),
      });
    }
    const account = accountMap.get(t.account);
    if (!account) continue;
    account.transactionCount += 1;

    if (t.type === "income") {
      account.income += t.amount;
    } else {
      account.expense += t.amount;
    }
    account.balance = account.income - account.expense;

    const catKey = `${t.type}-${t.primaryCategory}`;
    account.categories.set(catKey, (account.categories.get(catKey) ?? 0) + t.amount);
  }

  return Array.from(accountMap.values()).sort(
    (a, b) => b.income + b.expense - (a.income + a.expense),
  );
};

export const buildAccountGroups = (
  accountData: AccountSummary[],
  groupBy: GroupByType,
  accountTypes?: AccountTypeConfig[],
): AccountGroup[] => {
  const groupMap = new Map<string, AccountGroup>();

  for (const acc of accountData) {
    const groupKey =
      groupBy === "type"
        ? (accountTypes?.find((c) => c.accountName === acc.name)?.type ?? "unclassified")
        : getAccountPrefix(acc.name);

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        prefix: groupKey,
        accounts: [],
        totalIncome: 0,
        totalExpense: 0,
        totalBalance: 0,
        totalTransactions: 0,
        ...(groupBy === "type" ? { accountType: groupKey as AccountType } : {}),
      });
    }

    const group = groupMap.get(groupKey);
    if (!group) continue;
    group.accounts.push(acc);
    group.totalIncome += acc.income;
    group.totalExpense += acc.expense;
    group.totalBalance += acc.balance;
    group.totalTransactions += acc.transactionCount;
  }

  return Array.from(groupMap.values()).sort(
    (a, b) => b.totalIncome + b.totalExpense - (a.totalIncome + a.totalExpense),
  );
};

export const buildChartData = (accountData: AccountSummary[]) => {
  return accountData.map((acc) => ({
    name: acc.name,
    income: acc.income,
    expense: acc.expense,
    balance: acc.balance,
  }));
};

export const buildPieData = (accountData: AccountSummary[], threshold = 5) => {
  const total = accountData.reduce((sum, acc) => sum + acc.income + acc.expense, 0);
  if (total <= 0) return [];

  const major = accountData.filter((acc) => {
    const value = acc.income + acc.expense;
    return (value / total) * 100 >= threshold;
  });

  const othersTotal = accountData
    .filter((acc) => {
      const value = acc.income + acc.expense;
      return (value / total) * 100 < threshold;
    })
    .reduce((sum, acc) => sum + acc.income + acc.expense, 0);

  const result = major.map((acc) => ({
    name: acc.name,
    value: acc.income + acc.expense,
    percentage: ((acc.income + acc.expense) / total) * 100,
  }));

  if (othersTotal > 0) {
    result.push({
      name: "其他",
      value: othersTotal,
      percentage: (othersTotal / total) * 100,
    });
  }

  return result;
};

export const buildAccountSummaryStats = (
  accountData: AccountSummary[],
  transactions: DomainTransaction[],
) => {
  const totalIncome = accountData.reduce((sum, acc) => sum + acc.income, 0);
  const totalExpense = accountData.reduce((sum, acc) => sum + acc.expense, 0);
  const totalFlow = transactions.reduce((sum, t) => sum + t.amount, 0);

  return {
    accountCount: accountData.length,
    totalTransactions: transactions.length,
    totalFlow,
    totalIncome,
    totalExpense,
  };
};
