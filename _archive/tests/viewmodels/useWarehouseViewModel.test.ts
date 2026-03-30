import { describe, expect, it, beforeEach, vi } from 'bun:test';
import { renderHook, act } from '@testing-library/react';
import { useWarehouseViewModel } from '../../src/viewmodels/assets/useWarehouseViewModel';

const mockUpdate = vi.fn();
const mockDeploy = vi.fn();
const mockRecall = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

vi.mock('../../src/hooks/useAssets', () => ({
  useUnitsDisplay: () => ({ data: [], isLoading: false }),
  useProducts: () => ({ data: [] }),
  useUpdateUnit: () => ({ mutate: mockUpdate, isPending: false }),
  useDeployUnit: () => ({ mutate: mockDeploy, isPending: false }),
  useRecallUnit: () => ({ mutate: mockRecall, isPending: false }),
}));

vi.mock('../../src/hooks/useTransactions', () => ({
  useTransactions: () => ({ transactions: [] }),
}));

describe('useWarehouseViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens dialog on unit click', () => {
    const { result } = renderHook(() => useWarehouseViewModel());

    act(() => {
      result.current.handleUnitClick({
        id: '1',
        user_id: 'u1',
        unit_code: 'A01',
        amount: 10,
        currency: 'CNY',
        status: '已成立',
        strategy: '长期理财',
        tactics: '稳健理财',
        created_at: '2024-01-01',
      });
    });

    expect(result.current.editDeployDialog.open).toBe(true);
  });
});
