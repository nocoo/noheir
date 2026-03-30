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

  it('creates unit with note field', () => {
    const { result } = renderHook(() => useCapitalUnitsManagerViewModel());

    act(() => {
      result.current.handleCreate({
        unit_code: 'A02',
        amount: 5000,
        currency: 'CNY',
        status: '已成立',
        strategy: '短期理财',
        tactics: '现金产品',
        note: '应急资金',
      });
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ note: '应急资金' }),
      expect.anything()
    );
  });

  it('creates unit without note (undefined)', () => {
    const { result } = renderHook(() => useCapitalUnitsManagerViewModel());

    act(() => {
      result.current.handleCreate({
        unit_code: 'A03',
        amount: 10000,
        currency: 'CNY',
        status: '已成立',
        strategy: '长期理财',
        tactics: '稳健理财',
      });
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.note).toBeUndefined();
  });

  it('updates unit with note via editDeploy handler', () => {
    const { result } = renderHook(() => useCapitalUnitsManagerViewModel());

    // Open the editDeploy dialog with a unit
    act(() => {
      result.current.setEditDeployDialog({
        open: true,
        unit: {
          id: 'unit-1',
          user_id: 'user-1',
          unit_code: 'A01',
          amount: 10000,
          currency: 'CNY',
          status: '已成立',
          strategy: '长期理财',
          tactics: '稳健理财',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
    });

    act(() => {
      result.current.handleEditDeploy({
        strategy: '长期理财',
        tactics: '稳健理财',
        note: '更新备注',
      });
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'unit-1',
        input: expect.objectContaining({ note: '更新备注' }),
      }),
      expect.anything()
    );
  });

  it('clears note by setting null via editDeploy handler', () => {
    const { result } = renderHook(() => useCapitalUnitsManagerViewModel());

    act(() => {
      result.current.setEditDeployDialog({
        open: true,
        unit: {
          id: 'unit-2',
          user_id: 'user-1',
          unit_code: 'B01',
          amount: 5000,
          currency: 'CNY',
          status: '已成立',
          strategy: '短期理财',
          tactics: '现金产品',
          note: '旧备注',
          created_at: '2026-01-01T00:00:00Z',
        },
      });
    });

    act(() => {
      result.current.handleEditDeploy({
        strategy: '短期理财',
        tactics: '现金产品',
        note: null,
      });
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'unit-2',
        input: expect.objectContaining({ note: null }),
      }),
      expect.anything()
    );
  });

  it('toggles sort order', () => {
    const { result } = renderHook(() => useCapitalUnitsManagerViewModel());

    act(() => {
      result.current.handleSort('unit_code');
    });

    expect(result.current.getSortOrder()).toBe('desc');
  });
});
