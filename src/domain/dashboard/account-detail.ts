import type {
  DomainTransaction,
  DomainTransfer,
  AccountType,
  AccountTypeConfig,
  BalanceAnchor,
} from "../types";

// ── Local Types ──

export interface DailyBalance {
  date: string;
  balance: number;
  income: number;
  expense: number;
}

export interface DisplayEntry {
  id: string;
  date: string;
  primaryCategory?: string | undefined;
  secondaryCategory?: string | undefined;
  tertiaryCategory?: string | undefined;
  type: "income" | "expense" | "transfer" | "anchor";
  amount: number;
  balance: number;
  balanceAfter: number;
  note?: string | undefined;
  isAnchor?: boolean | undefined;
}

export interface BalanceEntry {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  account: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  primaryCategory?: string | undefined;
  secondaryCategory?: string | undefined;
  tertiaryCategory?: string | undefined;
  description?: string | undefined;
}

type AnchorWithMeta = BalanceAnchor & { isStarting?: boolean };

// ── Builders ──

export const buildBalanceEntries = (
  transactions: DomainTransaction[],
  transfers: DomainTransfer[],
): BalanceEntry[] => {
  const entries: BalanceEntry[] = [];

  transactions.forEach((t) => {
    entries.push({
      id: `tx-${t.id}`,
      date: t.date,
      year: t.year,
      month: t.month,
      day: new Date(t.date).getDate(),
      account: t.account,
      type: t.type,
      amount: t.type === "income" ? t.amount : -t.amount,
      primaryCategory: t.primaryCategory,
      secondaryCategory: t.secondaryCategory ?? undefined,
      tertiaryCategory: t.tertiaryCategory,
      description: t.note ?? undefined,
    });
  });

  transfers.forEach((t) => {
    const inflow = t.inflowAmount;
    const outflow = t.outflowAmount;
    const accountParts = t.account.split("→").map((s) => s.trim());
    const fromAccount = accountParts[0] ?? t.account;
    const toAccount = accountParts[1] ?? t.account;

    if (outflow > 0 && fromAccount) {
      entries.push({
        id: `tf-from-${t.id}`,
        date: t.date,
        year: t.year,
        month: t.month,
        day: t.day,
        account: fromAccount,
        type: "transfer",
        amount: -outflow,
        primaryCategory: t.primaryCategory ?? undefined,
        secondaryCategory: t.secondaryCategory ?? undefined,
        tertiaryCategory: `转出 → ${toAccount}`,
        description: t.note ?? undefined,
      });
    }

    if (inflow > 0 && toAccount) {
      entries.push({
        id: `tf-to-${t.id}`,
        date: t.date,
        year: t.year,
        month: t.month,
        day: t.day,
        account: toAccount,
        type: "transfer",
        amount: inflow,
        primaryCategory: t.primaryCategory ?? undefined,
        secondaryCategory: t.secondaryCategory ?? undefined,
        tertiaryCategory: `转入 ← ${fromAccount}`,
        description: t.note ?? undefined,
      });
    }
  });

  return entries.sort((a, b) => a.date.localeCompare(b.date));
};

export const buildUniqueAccounts = (entries: BalanceEntry[]): string[] => {
  const accounts = new Set(entries.map((e) => e.account));
  return Array.from(accounts).sort();
};

export const buildAccountsByType = (
  accounts: string[],
  accountTypes?: AccountTypeConfig[],
): Record<AccountType, string[]> => {
  const grouped: Record<AccountType, string[]> = {
    debit: [],
    credit: [],
    prepaid: [],
    financial: [],
    unclassified: [],
  };

  accounts.forEach((account) => {
    const type = accountTypes?.find((c) => c.accountName === account)?.type ?? "unclassified";
    grouped[type].push(account);
  });

  Object.keys(grouped).forEach((type) => {
    grouped[type as AccountType].sort();
  });

  return grouped;
};

export const buildAccountType = (
  accountName: string,
  accountTypes?: AccountTypeConfig[],
): AccountType => {
  return accountTypes?.find((c) => c.accountName === accountName)?.type ?? "unclassified";
};

export const buildAccountDetailData = (
  entries: BalanceEntry[],
  selectedAccount: string,
  selectedYear: number,
  balanceAnchors?: BalanceAnchor[],
) => {
  if (!selectedAccount) {
    return {
      dailyBalances: [] as DailyBalance[],
      displayEntries: [] as DisplayEntry[],
      summary: null,
      displayAnchors: [] as BalanceAnchor[],
    };
  }

  const accountEntries = entries
    .filter((e) => e.account === selectedAccount)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (accountEntries.length === 0) {
    return {
      dailyBalances: [] as DailyBalance[],
      displayEntries: [] as DisplayEntry[],
      summary: null,
      displayAnchors: [] as BalanceAnchor[],
    };
  }

  const accountAnchors =
    balanceAnchors
      ?.filter((a) => a.accountName === selectedAccount)
      .sort((a, b) => a.date.localeCompare(b.date)) ?? [];

  const yearStartDate = `${selectedYear}-01-01`;
  const yearEndDate = `${selectedYear}-12-31`;
  const displayAnchors = accountAnchors.filter(
    (a) => a.date >= yearStartDate && a.date <= yearEndDate,
  );

  const startingAnchor = accountAnchors.filter((a) => a.date <= yearStartDate).pop();
  const startingBalance = startingAnchor?.balance ?? 0;

  let yearAnchors: AnchorWithMeta[] = [
    ...(startingAnchor ? [{ ...startingAnchor, isStarting: true }] : []),
    ...displayAnchors.map((a) => ({ ...a, isStarting: false })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  if (yearAnchors.length === 0) {
    yearAnchors = [
      {
        accountName: selectedAccount,
        date: yearStartDate,
        balance: 0,
        isStarting: true,
      },
    ];
  }

  // Build daily balance map
  const balanceMap = new Map<string, DailyBalance>();

  displayAnchors.forEach((anchor) => {
    if (!balanceMap.has(anchor.date)) {
      balanceMap.set(anchor.date, {
        date: anchor.date,
        balance: anchor.balance,
        income: 0,
        expense: 0,
      });
    }
  });

  for (let i = 0; i < yearAnchors.length; i++) {
    const currentAnchor = yearAnchors[i];
    if (!currentAnchor) continue;
    const nextAnchor = yearAnchors[i + 1];

    let segmentStartBalance = currentAnchor.balance;
    const segmentStartDate =
      currentAnchor.isStarting || i === 0 ? yearStartDate : currentAnchor.date;
    const segmentEndDate = nextAnchor ? nextAnchor.date : yearEndDate;

    for (const entry of accountEntries) {
      if (entry.date < segmentStartDate) continue;
      if (entry.date > segmentEndDate) break;
      if (!currentAnchor.isStarting && entry.date === currentAnchor.date) {
        continue;
      }

      const date = entry.date;
      if (!balanceMap.has(date)) {
        balanceMap.set(date, {
          date,
          balance: segmentStartBalance,
          income: 0,
          expense: 0,
        });
      }

      const dayData = balanceMap.get(date);
      if (!dayData) continue;
      segmentStartBalance += entry.amount;

      if (entry.type === "income") {
        dayData.income += Math.abs(entry.amount);
      } else if (entry.type === "expense") {
        dayData.expense += Math.abs(entry.amount);
      }

      dayData.balance = segmentStartBalance;
    }
  }

  const dailyBalances = Array.from(balanceMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // Build display entries
  const displayEntries: DisplayEntry[] = [];

  for (let i = 0; i < yearAnchors.length; i++) {
    const currentAnchor = yearAnchors[i];
    if (!currentAnchor) continue;
    const nextAnchor = yearAnchors[i + 1];

    let segmentBalance = currentAnchor.balance;
    const segmentStartDate =
      currentAnchor.isStarting || i === 0 ? yearStartDate : currentAnchor.date;
    const segmentEndDate = nextAnchor ? nextAnchor.date : yearEndDate;

    if (
      !currentAnchor.isStarting &&
      currentAnchor.date >= yearStartDate &&
      currentAnchor.date <= yearEndDate
    ) {
      displayEntries.push({
        id: `anchor-${currentAnchor.date}`,
        date: currentAnchor.date,
        primaryCategory: "余额锚点",
        type: "anchor",
        amount: 0,
        balance: currentAnchor.balance,
        balanceAfter: currentAnchor.balance,
        note: `校准至 ¥${currentAnchor.balance.toFixed(2)}`,
        isAnchor: true,
      });
    }

    for (const entry of accountEntries) {
      if (entry.date < segmentStartDate) continue;
      if (entry.date > segmentEndDate) break;
      if (!currentAnchor.isStarting && entry.date === currentAnchor.date) {
        continue;
      }

      segmentBalance += entry.amount;
      const displayAmount = entry.type === "transfer" ? entry.amount : Math.abs(entry.amount);

      displayEntries.push({
        id: entry.id,
        date: entry.date,
        primaryCategory: entry.primaryCategory,
        secondaryCategory: entry.secondaryCategory,
        tertiaryCategory: entry.tertiaryCategory,
        type: entry.type,
        amount: displayAmount,
        balance: segmentBalance,
        balanceAfter: segmentBalance,
        note: entry.description,
      });
    }
  }

  displayEntries.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    if (a.isAnchor && !b.isAnchor) return -1;
    if (!a.isAnchor && b.isAnchor) return 1;
    return 0;
  });

  // Summary
  const yearEntries = accountEntries.filter((e) => e.year === selectedYear);
  const income = yearEntries
    .filter((e) => e.type === "income")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const expense = yearEntries
    .filter((e) => e.type === "expense")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const lastEntry = displayEntries[displayEntries.length - 1];
  const finalBalance = lastEntry ? lastEntry.balance : startingBalance;

  const summary = {
    totalIncome: income,
    totalExpense: expense,
    transactionCount: displayEntries.length,
    initialBalance: startingBalance,
    finalBalance,
    hasAnchor: !!startingAnchor,
  };

  return { dailyBalances, displayEntries, summary, displayAnchors };
};

export const sortDisplayEntries = (
  entries: DisplayEntry[],
  sortColumn: keyof DisplayEntry,
  sortDirection: "asc" | "desc",
): DisplayEntry[] => {
  if (!entries.length) return [];

  return [...entries].sort((a, b) => {
    if (a.isAnchor && b.isAnchor) return a.date.localeCompare(b.date);
    if (a.isAnchor) return -1;
    if (b.isAnchor) return 1;

    let aVal: string | number = a[sortColumn] as string | number;
    let bVal: string | number = b[sortColumn] as string | number;

    if (sortColumn === "type") {
      const typeLabels = {
        income: "收入",
        expense: "支出",
        transfer: "转账",
        anchor: "锚点",
      };
      aVal = typeLabels[a.type as keyof typeof typeLabels];
      bVal = typeLabels[b.type as keyof typeof typeLabels];
    } else if (sortColumn === "primaryCategory") {
      aVal = a.primaryCategory ?? "";
      bVal = b.primaryCategory ?? "";
    }

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
};
