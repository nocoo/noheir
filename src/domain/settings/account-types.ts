import type { AccountType, AccountTypeConfig } from "../types";

export const getUniqueAccounts = (transactions: Array<{ account: string }>) => {
  const accounts = new Set(transactions.map((t) => t.account));
  return Array.from(accounts).sort();
};

export const buildAccountTypesUpdate = (
  accountTypes: AccountTypeConfig[],
  accountName: string,
  type: AccountType,
) => {
  const existingIndex = accountTypes.findIndex((acc) => acc.accountName === accountName);
  const next = [...accountTypes];

  if (existingIndex >= 0) {
    next[existingIndex] = { accountName, type };
  } else {
    next.push({ accountName, type });
  }

  return next;
};

export const applyBatchAccountTypes = (
  accountTypes: AccountTypeConfig[],
  accounts: string[],
  type: AccountType,
) => {
  let next = [...accountTypes];

  accounts.forEach((accountName) => {
    next = buildAccountTypesUpdate(next, accountName, type);
  });

  return next;
};

export const groupAccountsByType = (accounts: string[], accountTypes: AccountTypeConfig[]) => {
  const grouped: Record<AccountType, string[]> = {
    debit: [],
    credit: [],
    prepaid: [],
    financial: [],
    unclassified: [],
  };

  accounts.forEach((account) => {
    const config = accountTypes.find((acc) => acc.accountName === account);
    const type = config?.type ?? "unclassified";
    grouped[type].push(account);
  });

  return grouped;
};
