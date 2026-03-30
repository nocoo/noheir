import type { BalanceAnchor } from '@/contexts/SettingsContext';

type TransactionLike = {
  account: string;
  fullDate?: string;
  date?: string;
  income?: number;
  expense?: number;
};

type DifferenceLevel = 'none' | 'info' | 'warning' | 'error' | null;

export const groupAnchorsByAccount = (anchors: BalanceAnchor[]) => {
  const grouped: Record<string, BalanceAnchor[]> = {};

  anchors.forEach(anchor => {
    if (!grouped[anchor.accountName]) {
      grouped[anchor.accountName] = [];
    }
    grouped[anchor.accountName].push(anchor);
  });

  Object.keys(grouped).forEach(account => {
    grouped[account].sort((a, b) => b.date.localeCompare(a.date));
  });

  return grouped;
};

export const getDifferenceLevel = (difference: number | null): DifferenceLevel => {
  if (difference === null) return null;
  if (difference < 1) return 'none';
  if (difference < 100) return 'info';
  if (difference < 1000) return 'warning';
  return 'error';
};

export const calculateBalanceAtDate = (params: {
  account: string;
  date: string;
  anchors: BalanceAnchor[];
  transactions: TransactionLike[];
  inputBalance?: number | null;
}) => {
  const { account, date, anchors, transactions, inputBalance } = params;

  if (!account || !date) {
    return { calculatedBalance: null, balanceDifference: null, differenceLevel: null } as const;
  }

  const accountAnchors = anchors
    .filter(a => a.accountName === account && a.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const baseAnchor = accountAnchors.length > 0 ? accountAnchors[accountAnchors.length - 1] : null;
  const baseBalance = baseAnchor?.balance || 0;
  const baseDate = baseAnchor?.date || '2000-01-01';

  const accountTransactions = transactions.filter(t => t.account === account);
  let calculated = baseBalance;

  accountTransactions.forEach(t => {
    const txDate = t.fullDate ?? t.date ?? '';
    if (!txDate) return;
    if (txDate <= baseDate) return;
    if (txDate > date) return;
    calculated += t.income || 0;
    calculated -= t.expense || 0;
  });

  const difference = inputBalance !== null && inputBalance !== undefined
    ? Math.abs(inputBalance - calculated)
    : null;

  return {
    calculatedBalance: calculated,
    balanceDifference: difference,
    differenceLevel: getDifferenceLevel(difference),
  } as const;
};

export const calculateAnchorDifferences = (params: {
  anchorsByAccount: Record<string, BalanceAnchor[]>;
  anchors: BalanceAnchor[];
  transactions: TransactionLike[];
}) => {
  const { anchorsByAccount, anchors, transactions } = params;
  const differences: Record<string, number> = {};

  Object.entries(anchorsByAccount).forEach(([accountName, accountAnchors]) => {
    accountAnchors.forEach(anchor => {
      const previousAnchors = anchors
        .filter(a => a.accountName === accountName && a.date < anchor.date)
        .sort((a, b) => a.date.localeCompare(b.date));

      const baseAnchor = previousAnchors.length > 0 ? previousAnchors[previousAnchors.length - 1] : null;
      const baseBalance = baseAnchor?.balance || 0;
      const baseDate = baseAnchor?.date || '2000-01-01';

      const accountTransactions = transactions.filter(t => t.account === accountName);
      let calculated = baseBalance;

      accountTransactions.forEach(t => {
        const txDate = t.fullDate ?? t.date ?? '';
        if (!txDate) return;
        if (txDate <= baseDate) return;
        if (txDate > anchor.date) return;
        calculated += t.income || 0;
        calculated -= t.expense || 0;
      });

      const diff = Math.abs(anchor.balance - calculated);
      differences[`${accountName}-${anchor.date}`] = diff;
    });
  });

  return differences;
};
