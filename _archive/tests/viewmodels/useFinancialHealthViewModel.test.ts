import { describe, expect, it } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useFinancialHealthViewModel } from '../../src/viewmodels/dashboard/useFinancialHealthViewModel';

describe('useFinancialHealthViewModel', () => {
  it('builds health result', () => {
    const { result } = renderHook(() => useFinancialHealthViewModel({
      transactions: [],
      totalIncome: 0,
      monthlyData: [],
      fixedExpenseCategories: [],
    }));

    expect(result.current.healthResult.maxScore).toBe(100);
  });
});
