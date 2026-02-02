import { describe, expect, it, beforeEach, afterEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useBalanceAnchorSettingsViewModel } from '../../src/viewmodels/settings/useBalanceAnchorSettingsViewModel';

const mockAddBalanceAnchor = vi.fn();
const mockRemoveBalanceAnchor = vi.fn();
const mockUpdateSingleSetting = vi.fn();

vi.mock('../../src/hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [
      { account: 'A', date: '2024-01-05', income: 50 },
    ],
  }),
}));

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { balanceAnchors: [] },
    addBalanceAnchor: mockAddBalanceAnchor,
    removeBalanceAnchor: mockRemoveBalanceAnchor,
  }),
}));

vi.mock('../../src/hooks/useSupabaseSettings', () => ({
  useSupabaseSettings: () => ({
    updateSingleSetting: mockUpdateSingleSetting,
  }),
}));

describe('useBalanceAnchorSettingsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds anchor and debounces db update', () => {
    const toast = { success: vi.fn(), error: vi.fn() };
    const { result } = renderHook(() => useBalanceAnchorSettingsViewModel(toast));

    act(() => {
      result.current.setSelectedAccount('A');
      result.current.setSelectedDate('2024-01-06');
      result.current.setBalance('100');
    });

    act(() => {
      result.current.handleAddAnchor();
    });

    expect(mockAddBalanceAnchor).toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockUpdateSingleSetting).toHaveBeenCalled();
  });
});
