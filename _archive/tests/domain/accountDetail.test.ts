import { describe, expect, it } from 'bun:test';
import {
  buildAccountDetailData,
  buildAccountsByType,
  buildBalanceEntries,
  buildUniqueAccounts,
  sortDisplayEntries,
} from '../../src/domain/dashboard/accountDetail';

const transactions = [
  {
    id: 't1',
    date: '2024-01-02',
    year: 2024,
    month: 1,
    primaryCategory: '工资',
    secondaryCategory: '本职',
    tertiaryCategory: '月薪',
    amount: 1000,
    account: '平安-主卡',
    description: '工资',
    type: 'income',
  },
  {
    id: 't2',
    date: '2024-01-03',
    year: 2024,
    month: 1,
    primaryCategory: '餐饮',
    secondaryCategory: '午餐',
    tertiaryCategory: '快餐',
    amount: 200,
    account: '平安-主卡',
    description: '午餐',
    type: 'expense',
  },
];

const transfers = [
  {
    id: 'tr1',
    user_id: 'u1',
    date: '2024-01-04',
    year: 2024,
    month: 1,
    day: 4,
    primary_category: null,
    secondary_category: '转账',
    transaction_type: '转账',
    inflow_amount: 300,
    outflow_amount: 300,
    currency: 'CNY',
    account: '平安-主卡 → 支付宝-基金',
    tags: [],
    note: '转账',
    raw_index: null,
    created_at: '2024-01-04T00:00:00Z',
  },
];

describe('accountDetail domain', () => {
  it('builds balance entries from transactions and transfers', () => {
    const entries = buildBalanceEntries(transactions, transfers);
    expect(entries.length).toBe(4);
  });

  it('builds unique accounts and groups by type', () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const accounts = buildUniqueAccounts(entries);
    expect(accounts).toContain('平安-主卡');

    const grouped = buildAccountsByType(accounts, [
      { accountName: '平安-主卡', type: 'debit' },
    ]);
    expect(grouped.debit).toContain('平安-主卡');
  });

  it('builds account detail data with summary', () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const detail = buildAccountDetailData(entries, '平安-主卡', 2024, []);
    expect(detail.summary?.totalIncome).toBe(1000);
  });

  it('sorts display entries', () => {
    const entries = buildBalanceEntries(transactions, transfers);
    const detail = buildAccountDetailData(entries, '平安-主卡', 2024, []);
    const sorted = sortDisplayEntries(detail.displayEntries, 'amount', 'desc');
    expect(sorted.length).toBe(detail.displayEntries.length);
  });
});
