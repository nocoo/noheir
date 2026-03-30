import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useThemeSettingsViewModel } from '../../src/viewmodels/settings/useThemeSettingsViewModel';

const mockUpdateTheme = vi.fn();
const mockUpdateColorScheme = vi.fn();

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: { theme: 'light', colorScheme: 'default' },
    updateTheme: mockUpdateTheme,
    updateColorScheme: mockUpdateColorScheme,
  }),
}));

describe('useThemeSettingsViewModel', () => {
  const toast = { success: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates theme and shows toast', () => {
    const { result } = renderHook(() => useThemeSettingsViewModel(toast));

    act(() => {
      result.current.handleThemeChange('dark');
    });

    expect(mockUpdateTheme).toHaveBeenCalledWith('dark');
    expect(toast.success).toHaveBeenCalled();
  });

  it('updates color scheme and shows toast', () => {
    const { result } = renderHook(() => useThemeSettingsViewModel(toast));

    act(() => {
      result.current.handleColorSchemeChange('swapped');
    });

    expect(mockUpdateColorScheme).toHaveBeenCalledWith('swapped');
    expect(toast.success).toHaveBeenCalled();
  });
});
