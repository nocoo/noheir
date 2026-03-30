import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useCapitalDecisionsViewModel } from '../../src/viewmodels/assets/useCapitalDecisionsViewModel';

const mockUpdate = vi.fn();
const mockDeploy = vi.fn();
const mockRecall = vi.fn();

vi.mock('../../src/hooks/useAssets', () => ({
  useUnitsDisplay: () => ({
    data: [],
    isLoading: false,
  }),
  useProducts: () => ({
    data: [],
  }),
  useUpdateUnit: () => ({ mutate: mockUpdate, isPending: false }),
  useDeployUnit: () => ({ mutate: mockDeploy, isPending: false }),
  useRecallUnit: () => ({ mutate: mockRecall, isPending: false }),
}));

describe('useCapitalDecisionsViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates sort column', () => {
    const { result } = renderHook(() => useCapitalDecisionsViewModel());

    act(() => {
      result.current.handleSort('紧急度');
    });

    expect(result.current.sortColumn).toBe('紧急度');
  });
});
