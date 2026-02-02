import type { Transaction } from '@/types/transaction';
import type { AccountType, AccountTypeConfig } from '@/contexts/SettingsContext';

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

export type GroupByType = 'prefix' | 'type';

export const getAccountPrefix = (accountName: string): string => {
  const hyphenIndex = accountName.indexOf('-');
  if (hyphenIndex > 0) {
    return accountName.substring(0, hyphenIndex).trim();
  }
  return accountName;
};

export const buildAccountData = (transactions: Transaction[]): AccountSummary[] => {
  const accountMap = new Map<string, AccountSummary>();

  transactions.forEach(t => {
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
    const account = accountMap.get(t.account)!;
    account.transactionCount += 1;

    if (t.type === 'income') {
      account.income += t.amount;
    } else {
      account.expense += t.amount;
    }
    account.balance = account.income - account.expense;

    const catKey = `${t.type}-${t.primaryCategory}`;
    account.categories.set(catKey, (account.categories.get(catKey) || 0) + t.amount);
  });

  return Array.from(accountMap.values()).sort((a, b) =>
    (b.income + b.expense) - (a.income + a.expense)
  );
};

export const buildAccountGroups = (
  accountData: AccountSummary[],
  groupBy: GroupByType,
  accountTypes?: AccountTypeConfig[]
): AccountGroup[] => {
  const groupMap = new Map<string, AccountGroup>();

  accountData.forEach(acc => {
    const groupKey = groupBy === 'type'
      ? (accountTypes?.find(c => c.accountName === acc.name)?.type || 'unclassified')
      : getAccountPrefix(acc.name);

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        prefix: groupKey,
        accounts: [],
        totalIncome: 0,
        totalExpense: 0,
        totalBalance: 0,
        totalTransactions: 0,
        accountType: groupBy === 'type' ? groupKey as AccountType : undefined,
      });
    }

    const group = groupMap.get(groupKey)!;
    group.accounts.push(acc);
    group.totalIncome += acc.income;
    group.totalExpense += acc.expense;
    group.totalBalance += acc.balance;
    group.totalTransactions += acc.transactionCount;
  });

  return Array.from(groupMap.values()).sort((a, b) =>
    (b.totalIncome + b.totalExpense) - (a.totalIncome + a.totalExpense)
  );
};

export const buildChartData = (accountData: AccountSummary[]) => {
  return accountData.map(acc => ({
    name: acc.name,
    收入: acc.income,
    支出: acc.expense,
    结余: acc.balance,
  }));
};

export const buildPieData = (accountData: AccountSummary[], threshold = 5) => {
  const total = accountData.reduce((sum, acc) => sum + acc.income + acc.expense, 0);
  if (total <= 0) return [];

  const major = accountData.filter(acc => {
    const value = acc.income + acc.expense;
    return (value / total) * 100 >= threshold;
  });

  const othersTotal = accountData
    .filter(acc => {
      const value = acc.income + acc.expense;
      return (value / total) * 100 < threshold;
    })
    .reduce((sum, acc) => sum + acc.income + acc.expense, 0);

  const result = major.map(acc => ({
    name: acc.name,
    value: acc.income + acc.expense,
    percentage: ((acc.income + acc.expense) / total) * 100,
  }));

  if (othersTotal > 0) {
    result.push({
      name: '其他',
      value: othersTotal,
      percentage: (othersTotal / total) * 100,
    });
  }

  return result;
};

export const buildMonthlyByAccount = (transactions: Transaction[]) => {
  const monthMap = new Map<string, Map<string, { income: number; expense: number }>>();

  transactions.forEach(t => {
    const monthKey = `${t.month}月`;
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, new Map());
    }
    const accountData = monthMap.get(monthKey)!;
    if (!accountData.has(t.account)) {
      accountData.set(t.account, { income: 0, expense: 0 });
    }
    const data = accountData.get(t.account)!;
    if (t.type === 'income') {
      data.income += t.amount;
    } else {
      data.expense += t.amount;
    }
  });

  const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const accounts = [...new Set(transactions.map(t => t.account))];

  return months.map((month, i): Record<string, string | number> => {
    const monthData = monthMap.get(`${i + 1}月`) || new Map();
    const result: Record<string, string | number> = { month };
    accounts.forEach(acc => {
      const data = monthData.get(acc) || { income: 0, expense: 0 };
      result[`${acc}_income`] = data.income;
      result[`${acc}_expense`] = data.expense;
    });
    return result;
  });
};

export const buildTopTransactionCounts = (accountData: AccountSummary[], limit = 20) => {
  return accountData
    .map(acc => ({
      name: acc.name,
      count: acc.transactionCount,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

export const buildAccountSummaryStats = (accountData: AccountSummary[], transactions: Transaction[]) => {
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
