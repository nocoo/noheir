import { describe, expect, it } from 'bun:test';
import {
  buildAverageMonthly,
  buildFilteredTransactions,
  buildMonthlyFiltered,
  buildTopTransactions,
  buildTotalAmount,
  buildTransactionLabels,
} from '../../src/domain/dashboard/transactionAnalysis';

describe('transactionAnalysis domain', () => {
  const transactions = [
    {
      id: '1',
      date: '2024-01-01',
      year: 2024,
      month: 1,
      primaryCategory: '收入',
      secondaryCategory: '工资',
      tertiaryCategory: '月薪',
      amount: 1000,
      account: 'A',
      type: 'income',
    },
    {
      id: '2',
      date: '2024-01-02',
      year: 2024,
      month: 1,
      primaryCategory: '支出',
      secondaryCategory: '餐饮',
      tertiaryCategory: '午餐',
      amount: 200,
      account: 'A',
      type: 'expense',
    },
  ];

  it('builds filtered and totals', () => {
    const filtered = buildFilteredTransactions(transactions, 'income');
    expect(filtered.length).toBe(1);
    expect(buildTotalAmount(filtered)).toBe(1000);
  });

  it('builds monthly average', () => {
    const monthly = buildMonthlyFiltered([
      { month: '1月', income: 1000, expense: 200, balance: 800 },
    ], 'income');
    expect(buildAverageMonthly(monthly, 'income')).toBe(1000);
  });

  it('builds top transactions', () => {
    const top = buildTopTransactions(transactions, 1);
    expect(top.length).toBe(1);
  });

  it('builds labels', () => {
    const labels = buildTransactionLabels('expense');
    expect(labels.total).toBe('总支出');
  });
});
