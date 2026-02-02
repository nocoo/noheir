import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useLiquidityLadderViewModel } from '../../src/viewmodels/assets/useLiquidityLadderViewModel';

vi.mock('../../src/hooks/useAssets', () => ({
  useUnitsDisplay: () => ({ data: [] }),
}));

describe('useLiquidityLadderViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty monthly data when no units', () => {
    const { result } = renderHook(() => useLiquidityLadderViewModel());
    expect(result.current.monthlyData.months.length).toBe(0);
  });
});
