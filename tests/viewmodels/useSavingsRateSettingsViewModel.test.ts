import { describe, expect, it, beforeEach, afterEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useSavingsRateSettingsViewModel } from '../../src/viewmodels/settings/useSavingsRateSettingsViewModel';

const mockUpdateTargetSavingsRate = vi.fn();
const mockUpdateSingleSetting = vi.fn();

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1' } }),
}));

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { targetSavingsRate: 60 },
    updateTargetSavingsRate: mockUpdateTargetSavingsRate,
  }),
}));

vi.mock('../../src/hooks/useSupabaseSettings', () => ({
  useSupabaseSettings: () => ({
    data: { settings: { targetSavingsRate: 60 } },
    loading: false,
    updateSingleSetting: mockUpdateSingleSetting,
  }),
}));

describe('useSavingsRateSettingsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates local settings immediately and debounces db write', () => {
    const { result } = renderHook(() => useSavingsRateSettingsViewModel());

    act(() => {
      result.current.handleRateChange(72);
    });

    expect(mockUpdateTargetSavingsRate).toHaveBeenCalledWith(72);
    expect(mockUpdateSingleSetting).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockUpdateSingleSetting).toHaveBeenCalledWith('targetSavingsRate', 72);
  });
});
