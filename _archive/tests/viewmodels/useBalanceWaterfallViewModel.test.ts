import { describe, expect, it, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useBalanceWaterfallViewModel } from '../../src/viewmodels/dashboard/useBalanceWaterfallViewModel';

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { colorScheme: 'default' },
  }),
  getIncomeColor: () => 'text-green-500',
  getIncomeColorHex: () => '#00aa00',
  getExpenseColor: () => 'text-red-500',
  getExpenseColorHex: () => '#aa0000',
}));

describe('useBalanceWaterfallViewModel', () => {
  it('builds waterfall data', () => {
    const { result } = renderHook(() => useBalanceWaterfallViewModel({
      data: [{ month: '1月', income: 1000, expense: 400, balance: 600 }],
    }));
    expect(result.current.cumulativeBalance).toBe(600);
  });
});
