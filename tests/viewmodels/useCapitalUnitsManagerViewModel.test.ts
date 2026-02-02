import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useCapitalUnitsManagerViewModel } from '../../src/viewmodels/assets/useCapitalUnitsManagerViewModel';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockDeploy = vi.fn();
const mockRecall = vi.fn();
const mockArchive = vi.fn();

vi.mock('../../src/hooks/useAssets', () => ({
  useUnitsDisplay: () => ({ data: [], isLoading: false }),
  useProducts: () => ({ data: [] }),
  useCreateUnit: () => ({ mutate: mockCreate, isPending: false }),
  useUpdateUnit: () => ({ mutate: mockUpdate, isPending: false }),
  useDeleteUnit: () => ({ mutate: mockDelete, isPending: false }),
  useDeployUnit: () => ({ mutate: mockDeploy, isPending: false }),
  useRecallUnit: () => ({ mutate: mockRecall, isPending: false }),
  useArchiveUnit: () => ({ mutate: mockArchive, isPending: false }),
}));

vi.mock('../../src/hooks/useFilteredAndSorted', () => ({
  useFilteredAndSorted: () => [],
}));

describe('useCapitalUnitsManagerViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates unit via mutation', () => {
    const { result } = renderHook(() => useCapitalUnitsManagerViewModel());

    act(() => {
      result.current.handleCreate({
        unit_code: 'A01',
        amount: 10000,
        currency: 'CNY',
        status: '已成立',
        strategy: '长期理财',
        tactics: '稳健理财',
      });
    });

    expect(mockCreate).toHaveBeenCalled();
  });

  it('toggles sort order', () => {
    const { result } = renderHook(() => useCapitalUnitsManagerViewModel());

    act(() => {
      result.current.handleSort('unit_code');
    });

    expect(result.current.getSortOrder()).toBe('desc');
  });
});
