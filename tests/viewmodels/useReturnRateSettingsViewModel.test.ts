import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useReturnRateSettingsViewModel } from '../../src/viewmodels/settings/useReturnRateSettingsViewModel';

const mockUpdateMinReturnRate = vi.fn();
const mockUpdateMaxReturnRate = vi.fn();

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { minReturnRate: 1.25, maxReturnRate: 4.0 },
    updateMinReturnRate: mockUpdateMinReturnRate,
    updateMaxReturnRate: mockUpdateMaxReturnRate,
  }),
}));

describe('useReturnRateSettingsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clamps min and max values', () => {
    const { result } = renderHook(() => useReturnRateSettingsViewModel());

    act(() => {
      result.current.handleMinChange(-1);
      result.current.handleMaxChange(20);
    });

    expect(mockUpdateMinReturnRate).toHaveBeenCalledWith(0);
    expect(mockUpdateMaxReturnRate).toHaveBeenCalledWith(15);
  });
});
