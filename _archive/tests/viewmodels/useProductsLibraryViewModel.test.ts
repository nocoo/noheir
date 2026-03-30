import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useProductsLibraryViewModel } from '../../src/viewmodels/assets/useProductsLibraryViewModel';

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../src/hooks/useAssets', () => ({
  useProducts: () => ({ data: [], isLoading: false }),
  useUnitsDisplay: () => ({ data: [] }),
  useCreateProduct: () => ({ mutate: mockCreate, isPending: false }),
  useUpdateProduct: () => ({ mutate: mockUpdate, isPending: false }),
  useDeleteProduct: () => ({ mutate: mockDelete, isPending: false }),
}));

vi.mock('../../src/hooks/useFilteredAndSorted', () => ({
  useFilteredAndSorted: () => [],
}));

describe('useProductsLibraryViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates product via mutation', () => {
    const { result } = renderHook(() => useProductsLibraryViewModel());

    act(() => {
      result.current.handleCreate({
        name: 'Test',
        channel: '招商银行',
        category: '定期存款',
        currency: 'CNY',
        lock_period_days: 0,
      });
    });

    expect(mockCreate).toHaveBeenCalled();
  });

  it('resets filters', () => {
    const { result } = renderHook(() => useProductsLibraryViewModel());

    act(() => {
      result.current.setShowFilters(true);
      result.current.resetFilters();
    });

    expect(result.current.filterChannel).toBe('all');
  });
});
