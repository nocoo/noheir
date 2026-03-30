import { describe, expect, it, beforeEach, afterEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useActiveIncomeSettingsViewModel } from '../../src/viewmodels/settings/useActiveIncomeSettingsViewModel';

const mockUpdateActiveIncomeCategories = vi.fn();
const mockUpdateSingleSetting = vi.fn();

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1' } }),
}));

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { activeIncomeCategories: [] },
    updateActiveIncomeCategories: mockUpdateActiveIncomeCategories,
  }),
}));

vi.mock('../../src/hooks/useSupabaseSettings', () => ({
  useSupabaseSettings: () => ({
    data: { settings: { activeIncomeCategories: [] } },
    loading: false,
    updateSingleSetting: mockUpdateSingleSetting,
  }),
}));

describe('useActiveIncomeSettingsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toggles category and debounces db write', () => {
    const { result } = renderHook(() => useActiveIncomeSettingsViewModel());
    const [firstGroup] = Object.keys(result.current.grouped);
    const category = result.current.grouped[firstGroup][0];

    act(() => {
      result.current.handleToggleCategory(category);
    });

    expect(mockUpdateActiveIncomeCategories).toHaveBeenCalledWith([category]);
    expect(mockUpdateSingleSetting).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockUpdateSingleSetting).toHaveBeenCalledWith('activeIncomeCategories', [category]);
  });
});
