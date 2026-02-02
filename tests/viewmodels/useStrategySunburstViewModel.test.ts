import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useStrategySunburstViewModel } from '../../src/viewmodels/assets/useStrategySunburstViewModel';

vi.mock('../../src/hooks/useAssets', () => ({
  useUnitsDisplay: () => ({ data: [] }),
}));

vi.mock('../../src/contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: { siteName: '资产' } }),
}));

describe('useStrategySunburstViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes chart data', () => {
    const { result } = renderHook(() => useStrategySunburstViewModel());
    expect(result.current.chartData.name).toBe('资产');
  });
});
