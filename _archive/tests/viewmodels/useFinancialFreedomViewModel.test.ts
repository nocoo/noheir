import { describe, expect, it, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useFinancialFreedomViewModel } from '../../src/viewmodels/dashboard/useFinancialFreedomViewModel';

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { activeIncomeCategories: ['月薪'] },
  }),
}));

describe('useFinancialFreedomViewModel', () => {
  it('builds scenarios and updates sliders', () => {
    const { result } = renderHook(() => useFinancialFreedomViewModel({
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
      year: 2024,
    }));

    act(() => {
      result.current.setExpenseReductionPercent(30);
      result.current.setPassiveIncomeIncreasePercent(60);
    });

    expect(result.current.expenseReductionPercent).toBe(30);
    expect(result.current.passiveIncomeIncreasePercent).toBe(60);
  });
});
