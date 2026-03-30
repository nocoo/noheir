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

  describe('detectRecurringPayments', () => {
    it('returns empty array for empty transactions', async () => {
      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const result = RecurringPaymentDetector.detectRecurringPayments([]);
      expect(result).toEqual([]);
    });

    it('does not detect payments with fewer than 3 transactions', async () => {
      const transactions: Transaction[] = [
        buildTransaction({ id: 't-1', date: '2024-01-01' }),
        buildTransaction({ id: 't-2', date: '2024-02-01' }),
      ];

      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const result = RecurringPaymentDetector.detectRecurringPayments(transactions);
      expect(result).toEqual([]);
    });

    it('detects high consistency monthly payments', async () => {
      const transactions: Transaction[] = [
        buildTransaction({ id: 't-1', date: '2024-01-01', amount: 2000, tertiaryCategory: '房租' }),
        buildTransaction({ id: 't-2', date: '2024-02-01', amount: 2000, tertiaryCategory: '房租' }),
        buildTransaction({ id: 't-3', date: '2024-03-01', amount: 2000, tertiaryCategory: '房租' }),
        buildTransaction({ id: 't-4', date: '2024-04-01', amount: 2000, tertiaryCategory: '房租' }),
      ];

      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const result = RecurringPaymentDetector.detectRecurringPayments(transactions);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('房租');
      expect(result[0].occurrences).toBe(4);
      expect(result[0].frequency).toBe('monthly');
    });

    it('detects medium consistency payments', async () => {
      const transactions: Transaction[] = [
        buildTransaction({ id: 't-1', date: '2024-01-01', amount: 100, tertiaryCategory: '网费' }),
        buildTransaction({ id: 't-2', date: '2024-02-05', amount: 100, tertiaryCategory: '网费' }),
        buildTransaction({ id: 't-3', date: '2024-03-03', amount: 100, tertiaryCategory: '网费' }),
      ];

      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const result = RecurringPaymentDetector.detectRecurringPayments(transactions);
      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('网费');
      expect(result[0].frequency).toBe('monthly');
    });

    it('does not detect low consistency payments', async () => {
      const transactions: Transaction[] = [
        buildTransaction({ id: 't-1', date: '2024-01-01', amount: 500, tertiaryCategory: '购物' }),
        buildTransaction({ id: 't-2', date: '2024-02-10', amount: 600, tertiaryCategory: '购物' }),
        buildTransaction({ id: 't-3', date: '2024-03-01', amount: 400, tertiaryCategory: '购物' }),
      ];

      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const result = RecurringPaymentDetector.detectRecurringPayments(transactions);
      expect(result).toHaveLength(0);
    });

    it('detects weekly payments', async () => {
      const transactions: Transaction[] = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date(2024, 0, 1 + i * 7);
        transactions.push(
          buildTransaction({
            id: `t-${i}`,
            date: date.toISOString().split('T')[0],
            amount: 30,
            tertiaryCategory: '早餐',
            account: '支付宝',
          })
        );
      }

      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const result = RecurringPaymentDetector.detectRecurringPayments(transactions);
      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe('weekly');
    });

    it('deduplicates payments with same account and description', async () => {
      const transactions: Transaction[] = [
        buildTransaction({ id: 't-1', date: '2024-01-01', amount: 50, tertiaryCategory: 'Netflix', account: '信用卡' }),
        buildTransaction({ id: 't-2', date: '2024-02-01', amount: 50, tertiaryCategory: 'Netflix', account: '信用卡' }),
        buildTransaction({ id: 't-3', date: '2024-03-01', amount: 50, tertiaryCategory: 'Netflix', account: '信用卡' }),
      ];

      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const result = RecurringPaymentDetector.detectRecurringPayments(transactions);
      expect(result).toHaveLength(1);
    });
  });

  describe('generateInsights', () => {
    const basePayment = {
      id: 'credit-card-Netflix',
      description: 'Netflix',
      account: '信用卡',
      amount: 50,
      frequency: 'monthly' as const,
      nextPaymentDate: new Date().toISOString().split('T')[0],
      averageInterval: 30,
      occurrences: 3,
      totalAmount: 150,
      yearlyTotal: 600,
      category: '生活缴费',
      recentTransactions: [],
    };

    it('generates high priority insight for overdue payment', async () => {
      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const payment = {
        ...basePayment,
        nextPaymentDate: yesterday.toISOString().split('T')[0],
      };

      const result = RecurringPaymentDetector.generateInsights([payment]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('recurring_payment');
      expect(result[0].priority).toBe('high');
      expect(result[0].title).toContain('需要支付');
    });

    it('generates medium priority insight for upcoming payment', async () => {
      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const in5Days = new Date();
      in5Days.setDate(in5Days.getDate() + 5);
      const payment = {
        ...basePayment,
        nextPaymentDate: in5Days.toISOString().split('T')[0],
      };

      const result = RecurringPaymentDetector.generateInsights([payment]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('upcoming_renewal');
      expect(result[0].priority).toBe('medium');
      expect(result[0].title).toContain('即将到期');
    });

    it('generates budget alert for high yearly expenses', async () => {
      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const inFuture = new Date();
      inFuture.setDate(inFuture.getDate() + 30);
      const payment = {
        ...basePayment,
        nextPaymentDate: inFuture.toISOString().split('T')[0],
        yearlyTotal: 15000,
      };

      const result = RecurringPaymentDetector.generateInsights([payment]);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('budget_alert');
      expect(result[0].priority).toBe('medium');
      expect(result[0].title).toContain('高额月度支出');
    });

    it('sorts insights by priority', async () => {
      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const in5Days = new Date();
      in5Days.setDate(in5Days.getDate() + 5);
      const inFuture = new Date();
      inFuture.setDate(inFuture.getDate() + 30);

      const payment1 = {
        ...basePayment,
        id: '1',
        description: 'Overdue',
        nextPaymentDate: yesterday.toISOString().split('T')[0],
        yearlyTotal: 600,
      };
      const payment2 = {
        ...basePayment,
        id: '2',
        description: 'Upcoming',
        nextPaymentDate: in5Days.toISOString().split('T')[0],
        yearlyTotal: 600,
      };
      const payment3 = {
        ...basePayment,
        id: '3',
        description: 'Budget',
        nextPaymentDate: inFuture.toISOString().split('T')[0],
        yearlyTotal: 15000,
      };

      const result = RecurringPaymentDetector.generateInsights([payment3, payment2, payment1]);

      expect(result[0].priority).toBe('high');
      expect(result[1].priority).toBe('medium');
    });

    it('generates no insights for payments more than 7 days overdue', async () => {
      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 10);
      const payment = {
        ...basePayment,
        nextPaymentDate: longAgo.toISOString().split('T')[0],
      };

      const result = RecurringPaymentDetector.generateInsights([payment]);

      expect(result).toHaveLength(0);
    });

    it('generates no insights for payments more than 7 days in future', async () => {
      const { RecurringPaymentDetector } = await import(`../../src/services/insightService?test=${Date.now()}`);
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 15);
      const payment = {
        ...basePayment,
        nextPaymentDate: farFuture.toISOString().split('T')[0],
        yearlyTotal: 600,
      };

      const result = RecurringPaymentDetector.generateInsights([payment]);

      expect(result).toHaveLength(0);
    });
  });
});
