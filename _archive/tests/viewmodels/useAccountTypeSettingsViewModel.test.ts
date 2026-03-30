import { describe, expect, it, beforeEach, afterEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useAccountTypeSettingsViewModel } from '../../src/viewmodels/settings/useAccountTypeSettingsViewModel';

const mockUpdateAccountType = vi.fn();
const mockUpdateSingleSetting = vi.fn();

vi.mock('../../src/hooks/useTransactions', () => ({
  useTransactions: () => ({
    transactions: [
      { account: 'A' },
      { account: 'B' },
    ],
  }),
}));

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { accountTypes: [] },
    updateAccountType: mockUpdateAccountType,
  }),
  ACCOUNT_TYPE_CONFIG: {
    debit: { label: '借记卡', icon: () => null, color: 'bg-blue-500', description: '' },
    credit: { label: '信用卡', icon: () => null, color: 'bg-red-500', description: '' },
    prepaid: { label: '预付卡', icon: () => null, color: 'bg-purple-500', description: '' },
    financial: { label: '金融账户', icon: () => null, color: 'bg-green-500', description: '' },
    unclassified: { label: '未分类', icon: () => null, color: 'bg-gray-500', description: '' },
  },
}));

vi.mock('../../src/hooks/useSupabaseSettings', () => ({
  useSupabaseSettings: () => ({
    data: { settings: {} },
    updateSingleSetting: mockUpdateSingleSetting,
  }),
}));

describe('useAccountTypeSettingsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates account type and debounces db update', () => {
    const toast = { success: vi.fn(), error: vi.fn() };
    const { result } = renderHook(() => useAccountTypeSettingsViewModel(toast));

    act(() => {
      result.current.handleTypeChange('A', 'debit');
    });

    expect(mockUpdateAccountType).toHaveBeenCalledWith('A', 'debit');

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(mockUpdateSingleSetting).toHaveBeenCalled();
  });
});
