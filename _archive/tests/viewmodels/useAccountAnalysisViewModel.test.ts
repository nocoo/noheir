import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useAccountAnalysisViewModel } from '../../src/viewmodels/dashboard/useAccountAnalysisViewModel';

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { colorScheme: 'default', accountTypes: [] },
  }),
}));

describe('useAccountAnalysisViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds account data and updates groupBy', () => {
    const transactions = [
      {
        id: '1',
        date: '2024-01-02',
        year: 2024,
        month: 1,
        primaryCategory: '工资',
        secondaryCategory: '本职',
        tertiaryCategory: '月薪',
        amount: 1000,
        account: '平安-主卡',
        description: '工资',
        type: 'income',
      },
    ];

    const { result } = renderHook(() => useAccountAnalysisViewModel({ transactions }));
    expect(result.current.accountData.length).toBe(1);

    act(() => {
      result.current.setGroupBy('prefix');
    });

    expect(result.current.groupBy).toBe('prefix');
  });
});
