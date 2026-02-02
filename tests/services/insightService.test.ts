import { describe, it, expect, vi } from 'bun:test';
import type { Transaction } from '../../src/types/transaction';

const buildTransaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 't-1',
  date: '2024-01-01',
  year: 2024,
  month: 1,
  primaryCategory: '生活缴费',
  secondaryCategory: '通信费',
  tertiaryCategory: '通信费',
  amount: 30,
  account: '账户A',
  type: 'expense',
  description: undefined,
  ...overrides,
});

describe('insightService', () => {
  it('detects recurring payments for consistent patterns', async () => {
    const transactions: Transaction[] = [
      buildTransaction({ id: 't-1', date: '2024-01-01' }),
      buildTransaction({ id: 't-2', date: '2024-02-01' }),
      buildTransaction({ id: 't-3', date: '2024-03-01' }),
    ];

    const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
    const results = RecurringPaymentDetector.detectRecurringPayments(transactions);
    expect(results.length).toBe(1);
    expect(results[0].frequency).toBe('monthly');
  });

  it('generates insights for upcoming payments and budget alerts', async () => {
    const recurringPayments = [
      {
        id: '账户A-通信费',
        description: '通信费',
        account: '账户A',
        amount: 1000,
        frequency: 'monthly' as const,
        nextPaymentDate: '2024-02-01',
        averageInterval: 30,
        occurrences: 3,
        totalAmount: 3000,
        yearlyTotal: 24000,
        category: '生活缴费',
        recentTransactions: [
          { date: '2024-01-01', amount: 1000, description: '通信费' },
        ],
      },
    ];

    const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
    const insights = RecurringPaymentDetector.generateInsights(recurringPayments, '2024-01-25');
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].priority).toBe('medium');
  });
});
