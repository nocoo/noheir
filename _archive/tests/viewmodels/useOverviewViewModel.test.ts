import { describe, expect, it } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useOverviewViewModel } from '../../src/viewmodels/dashboard/useOverviewViewModel';

describe('useOverviewViewModel', () => {
  it('exposes savings rate', () => {
    const { result } = renderHook(() => useOverviewViewModel({
      transactions: [],
      monthlyData: [],
      totalIncome: 1000,
      totalExpense: 250,
      balance: 750,
      selectedYear: 2024,
      availableYears: [2024],
      onYearChange: () => undefined,
      targetSavingsRate: 60,
    }));

    expect(result.current.savingsRate).toBeCloseTo(75);
  });
});
