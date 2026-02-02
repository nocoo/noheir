import { describe, expect, it, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useTransactionAnalysisViewModel } from '../../src/viewmodels/dashboard/useTransactionAnalysisViewModel';

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { colorScheme: 'default' },
  }),
  getIncomeColor: () => 'text-green-500',
  getIncomeColorHex: () => '#00aa00',
  getExpenseColor: () => 'text-red-500',
  getExpenseColorHex: () => '#aa0000',
}));

describe('useTransactionAnalysisViewModel', () => {
  it('builds analysis data', () => {
    const { result } = renderHook(() => useTransactionAnalysisViewModel({
      transactions: [{
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
      }],
      monthlyData: [{ month: '1月', income: 1000, expense: 0, balance: 1000 }],
      type: 'income',
    }));
    expect(result.current.totalAmount).toBe(1000);
  });
});
