import { describe, expect, it, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useSavingsRateChartViewModel } from '../../src/viewmodels/dashboard/useSavingsRateChartViewModel';

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { colorScheme: 'default', targetSavingsRate: 30 },
  }),
  getIncomeColorHex: () => '#00aa00',
  getExpenseColorHex: () => '#aa0000',
  getSavingsRateStatus: () => 'met',
  getSavingsRateColor: () => 'text-green-500',
}));

describe('useSavingsRateChartViewModel', () => {
  it('builds chart data and summary', () => {
    const { result } = renderHook(() => useSavingsRateChartViewModel({
      data: [{ month: '1月', income: 1000, expense: 400, balance: 600 }],
    }));
    expect(result.current.summary.totalSavings).toBe(600);
  });
});
