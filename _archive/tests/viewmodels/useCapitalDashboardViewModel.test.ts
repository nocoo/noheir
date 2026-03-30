import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useCapitalDashboardViewModel } from '../../src/viewmodels/assets/useCapitalDashboardViewModel';

vi.mock('../../src/hooks/useAssets', () => ({
  useAssetDashboard: () => ({
    data: { total_assets: 100, invested_amount: 50, upcoming_maturities: [] },
    isLoading: false,
  }),
  useUnitsDisplay: () => ({
    data: [{ status: '已成立', currency: 'CNY', amount: 100 }],
    isLoading: false,
  }),
}));

describe('useCapitalDashboardViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates totals and deployment rate', () => {
    const { result } = renderHook(() => useCapitalDashboardViewModel());
    expect(result.current.totalAssetsAll).toBe(100);
    expect(result.current.deploymentRate).toBe(50);
  });

  it('updates selected strategy', () => {
    const { result } = renderHook(() => useCapitalDashboardViewModel());

    act(() => {
      result.current.handleStrategySelect('远期理财');
    });

    expect(result.current.selectedStrategy).toBe('远期理财');
  });
});
