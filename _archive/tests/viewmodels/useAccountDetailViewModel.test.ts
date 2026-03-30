import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useAccountDetailViewModel } from '../../src/viewmodels/dashboard/useAccountDetailViewModel';

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { accountTypes: [], balanceAnchors: [], colorScheme: 'default' },
  }),
}));

vi.mock('../../src/hooks/useTransfers', () => ({
  useTransfers: () => ({ transfers: [] }),
}));

describe('useAccountDetailViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes accounts and sorting behavior', () => {
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

    const { result } = renderHook(() => useAccountDetailViewModel({
      transactions,
      selectedYear: 2024,
      availableYears: [2024],
      onYearChange: vi.fn(),
    }));

    act(() => {
      result.current.setSelectedAccount('平安-主卡');
    });

    expect(result.current.accountsByType.unclassified).toContain('平安-主卡');

    act(() => {
      result.current.handleSort('amount');
    });

    expect(result.current.sortColumn).toBe('amount');
  });
});
