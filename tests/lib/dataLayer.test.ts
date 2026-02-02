import { describe, it, expect } from 'bun:test';
import type { ParsedTransaction } from '../../src/types/data';

const baseTransaction: ParsedTransaction = {
  id: 't-1',
  date: '2024-01-01',
  year: 2024,
  month: 1,
  day: 1,
  primaryCategory: '日常吃喝',
  secondaryCategory: '日常吃喝',
  tertiaryCategory: '吃饭',
  amount: 50,
  type: 'expense',
  account: '账户A',
  currency: '人民币',
  tags: [],
  note: undefined,
  rawIndex: 1,
  hasSecondaryMapping: true,
};

describe('dataLayer', () => {
  it('loads raw data and validates with metrics', async () => {
    const { createDataLayerManager } = await import(`../../src/lib/dataLayer?test=${Date.now()}`);
    const manager = createDataLayerManager();
    manager.loadRaw([baseTransaction]);

    const validations = manager.validate();
    const metrics = manager.getMetrics();

    expect(validations.length).toBe(1);
    expect(metrics?.totalRecords).toBe(1);
    expect(metrics?.expenseCount).toBe(1);
  });

  it('cleans transactions after validation', async () => {
    const { createDataLayerManager } = await import(`../../src/lib/dataLayer?test=${Date.now()}`);
    const manager = createDataLayerManager();
    manager.loadRaw([baseTransaction]);
    const cleaned = manager.clean();

    expect(cleaned.length).toBe(1);
    expect(cleaned[0].validationSeverity).toBe('valid');
  });

  it('aggregates by category and account', async () => {
    const { createDataLayerManager } = await import(`../../src/lib/dataLayer?test=${Date.now()}`);
    const manager = createDataLayerManager();
    manager.loadRaw([
      baseTransaction,
      {
        ...baseTransaction,
        id: 't-2',
        amount: 30,
        secondaryCategory: '外卖',
        tertiaryCategory: '外卖',
      },
    ]);
    manager.validate();
    manager.clean();

    const categories = manager.aggregateByCategory();
    const accounts = manager.aggregateByAccount();

    expect(categories.length).toBe(1);
    expect(categories[0].totalAmount).toBe(80);
    expect(categories[0].subcategories.length).toBe(2);
    expect(accounts.length).toBe(1);
    expect(accounts[0].expense).toBe(80);
  });

  it('filters by date range and account', async () => {
    const { createDataLayerManager } = await import(`../../src/lib/dataLayer?test=${Date.now()}`);
    const manager = createDataLayerManager();
    manager.loadRaw([
      baseTransaction,
      { ...baseTransaction, id: 't-2', date: '2024-02-01', month: 2 },
    ]);
    manager.validate();
    const cleaned = manager.clean();

    const january = manager.getByDateRange('2024-01-01', '2024-01-31', cleaned);
    const account = manager.getByAccount('账户A', cleaned);

    expect(january.length).toBe(1);
    expect(account.length).toBe(2);
  });

  it('returns summary statistics', async () => {
    const { createDataLayerManager } = await import(`../../src/lib/dataLayer?test=${Date.now()}`);
    const manager = createDataLayerManager();
    manager.loadRaw([
      baseTransaction,
      { ...baseTransaction, id: 't-2', type: 'income', primaryCategory: '薪资收入', secondaryCategory: '薪资收入', tertiaryCategory: '工资', amount: 200 },
    ]);
    manager.validate();
    manager.clean();

    const summary = manager.getSummary();
    expect(summary.totalTransactions).toBe(2);
    expect(summary.totalIncome).toBe(200);
    expect(summary.totalExpense).toBe(50);
  });
});
