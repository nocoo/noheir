import { describe, expect, it, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useYearComparisonViewModel } from '../../src/viewmodels/dashboard/useYearComparisonViewModel';

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { colorScheme: 'default', targetSavingsRate: 30 },
  }),
  getIncomeColorHex: () => '#00aa00',
  getExpenseColorHex: () => '#aa0000',
}));

describe('useYearComparisonViewModel', () => {
  it('builds chart data', () => {
    const { result } = renderHook(() => useYearComparisonViewModel({
      data: [{
        year: 2024,
        totalIncome: 1000,
        totalExpense: 400,
        balance: 600,
        categoryBreakdown: [],
      }],
    }));
    expect(result.current.chartData[0].year).toBe('2024');
  });
});
