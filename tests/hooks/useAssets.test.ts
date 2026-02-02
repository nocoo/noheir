import { describe, it, expect, vi } from 'bun:test';
import { renderHook } from '@testing-library/react';

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock('../../src/services/assetService', () => ({
  fetchProducts: vi.fn(),
  fetchProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  fetchUnits: vi.fn(),
  fetchUnitsFiltered: vi.fn(),
  fetchUnit: vi.fn(),
  createUnit: vi.fn(),
  updateUnit: vi.fn(),
  deleteUnit: vi.fn(),
  deployUnit: vi.fn(),
  recallUnit: vi.fn(),
  archiveUnit: vi.fn(),
  fetchCapitalOverview: vi.fn(),
  batchCreateUnits: vi.fn(),
  batchUpdateUnitStatuses: vi.fn(),
}));

describe('useAssets hooks', () => {
  it('calls useQuery for products', async () => {
    const { useProducts } = await import(`../../src/hooks/useAssets?test=${Date.now()}`);
    renderHook(() => useProducts());
    expect(mockUseQuery).toHaveBeenCalled();
  });

  it('calls useQuery for units', async () => {
    const { useUnits } = await import(`../../src/hooks/useAssets?test=${Date.now()}`);
    renderHook(() => useUnits());
    expect(mockUseQuery).toHaveBeenCalled();
  });

  it('calls useQuery for capital overview', async () => {
    const { useCapitalOverview } = await import(`../../src/hooks/useAssets?test=${Date.now()}`);
    renderHook(() => useCapitalOverview());
    expect(mockUseQuery).toHaveBeenCalled();
  });
});
