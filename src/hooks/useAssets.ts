/**
 * React Query hooks for Capital Asset Management
 *
 * Provides typed hooks for:
 * - Products CRUD operations
 * - Units CRUD operations
 * - Dashboard data
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchProducts,
  fetchProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchUnits,
  fetchUnitsFiltered,
  fetchUnit,
  createUnit,
  updateUnit,
  deleteUnit,
  deployUnit,
  recallUnit,
  archiveUnit,
  fetchCapitalOverview,
  batchCreateUnits,
  batchUpdateUnitStatuses,
} from '@/services/assetService';
import type {
  CreateFinancialProductInput,
  UpdateFinancialProductInput,
  CreateCapitalUnitInput,
  UpdateCapitalUnitInput,
  DeployUnitInput,
  UnitFilters,
  UnitSortBy,
  SortOrder,
} from '@/types/assets';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const assetQueryKeys = {
  // Products
  allProducts: ['assets', 'products'] as const,
  product: (id: string) => ['assets', 'products', id] as const,

  // Units
  allUnits: ['assets', 'units'] as const,
  unitsFiltered: (filters?: UnitFilters, sortBy?: UnitSortBy, sortOrder?: SortOrder) =>
    ['assets', 'units', 'filtered', filters, sortBy, sortOrder] as const,
  unit: (id: string) => ['assets', 'units', id] as const,
  unitsDisplay: (filters?: UnitFilters, sortBy?: UnitSortBy, sortOrder?: SortOrder) =>
    ['assets', 'units', 'display', filters, sortBy, sortOrder] as const,

  // Capital Overview (single source for dashboard page)
  capitalOverview: ['assets', 'capitalOverview'] as const,

  // Dashboard (deprecated, use capitalOverview)
  dashboard: ['assets', 'dashboard'] as const,
} as const;

// ============================================================================
// PRODUCTS HOOKS
// ============================================================================

/**
 * Fetch all financial products
 */
export function useProducts() {
  return useQuery({
    queryKey: assetQueryKeys.allProducts,
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single product by ID
 */
export function useProduct(id: string) {
  return useQuery({
    queryKey: assetQueryKeys.product(id),
    queryFn: () => fetchProduct(id),
    enabled: !!id,
  });
}

/**
 * Create a new product
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFinancialProductInput) => createProduct(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allProducts });
      toast.success('产品已创建');
    },
    onError: (error: Error) => {
      toast.error(error.message || '创建产品失败');
    },
  });
}

/**
 * Update a product
 */
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFinancialProductInput }) =>
      updateProduct(id, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allProducts });
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.product(variables.id) });
      toast.success('产品已更新');
    },
    onError: (error: Error) => {
      toast.error(error.message || '更新产品失败');
    },
  });
}

/**
 * Delete a product
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allProducts });
      toast.success('产品已删除');
    },
    onError: (error: Error) => {
      toast.error(error.message || '删除产品失败');
    },
  });
}

// ============================================================================
// UNITS HOOKS
// ============================================================================

/**
 * Fetch all capital units with products
 */
export function useUnits() {
  return useQuery({
    queryKey: assetQueryKeys.allUnits,
    queryFn: () => fetchUnits(true),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch units with optional filtering
 */
export function useUnitsFiltered(options?: {
  filters?: UnitFilters;
  sortBy?: UnitSortBy;
  sortOrder?: SortOrder;
}) {
  return useQuery({
    queryKey: assetQueryKeys.unitsFiltered(options?.filters, options?.sortBy, options?.sortOrder),
    queryFn: () => fetchUnitsFiltered(options || {}),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Fetch a single unit by ID
 */
export function useUnit(id: string) {
  return useQuery({
    queryKey: assetQueryKeys.unit(id),
    queryFn: () => fetchUnit(id),
    enabled: !!id,
  });
}

/**
 * Create a new unit (Mint)
 */
export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCapitalUnitInput) => createUnit(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allUnits });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success('资金单元已创建');
    },
    onError: (error: Error) => {
      toast.error(error.message || '创建资金单元失败');
    },
  });
}

/**
 * Update a unit
 */
export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCapitalUnitInput }) =>
      updateUnit(id, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allUnits });
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.unit(variables.id) });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success('资金单元已更新');
    },
    onError: (error: Error) => {
      toast.error(error.message || '更新资金单元失败');
    },
  });
}

/**
 * Delete a unit
 */
export function useDeleteUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allUnits });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success('资金单元已删除');
    },
    onError: (error: Error) => {
      toast.error(error.message || '删除资金单元失败');
    },
  });
}

/**
 * Deploy a unit to a product
 */
export function useDeployUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }: { unitId: string; input: DeployUnitInput }) =>
      deployUnit(unitId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allUnits });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success('资金已投放');
    },
    onError: (error: Error) => {
      toast.error(error.message || '投放资金失败');
    },
  });
}

/**
 * Recall a unit from a product
 */
export function useRecallUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => recallUnit(unitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allUnits });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success('资金已回收');
    },
    onError: (error: Error) => {
      toast.error(error.message || '回收资金失败');
    },
  });
}

/**
 * Archive a unit
 */
export function useArchiveUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => archiveUnit(unitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allUnits });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success('资金单元已归档');
    },
    onError: (error: Error) => {
      toast.error(error.message || '归档资金单元失败');
    },
  });
}

/**
 * Batch create units
 */
export function useBatchCreateUnits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inputs: CreateCapitalUnitInput[]) => batchCreateUnits(inputs),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allUnits });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success(`已创建 ${data.length} 个资金单元`);
    },
    onError: (error: Error) => {
      toast.error(error.message || '批量创建资金单元失败');
    },
  });
}

/**
 * Batch update unit statuses
 */
export function useBatchUpdateUnitStatuses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitIds, status }: { unitIds: string[]; status: CapitalUnit['status'] }) =>
      batchUpdateUnitStatuses(unitIds, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetQueryKeys.allUnits });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'assets' });
      toast.success('批量状态更新成功');
    },
    onError: (error: Error) => {
      toast.error(error.message || '批量更新状态失败');
    },
  });
}

// ============================================================================
// DASHBOARD HOOKS
// ============================================================================

/**
 * Unified hook for capital overview page
 * Single query that provides both dashboard metrics and unit display info
 */
export function useCapitalOverview() {
  return useQuery({
    queryKey: assetQueryKeys.capitalOverview,
    queryFn: fetchCapitalOverview,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
  });
}

/**
 * Fetch dashboard summary (derived from useCapitalOverview)
 */
export function useAssetDashboard() {
  const query = useCapitalOverview();
  return {
    ...query,
    data: query.data?.dashboard,
  };
}

/**
 * Fetch units with display info (derived from useCapitalOverview)
 * For filtered queries, use useUnitsFiltered instead
 */
export function useUnitsDisplay(options?: {
  filters?: UnitFilters;
  sortBy?: UnitSortBy;
  sortOrder?: SortOrder;
}) {
  const hasFilters = options?.filters || options?.sortBy;

  // Always call both hooks to maintain consistent hook order
  const overviewQuery = useCapitalOverview();
  const filteredQuery = useUnitsFiltered({
    ...options,
    withProducts: true,
  });

  // Return derived data from overview when no filters, otherwise use filtered query
  return hasFilters ? filteredQuery : {
    ...overviewQuery,
    data: overviewQuery.data?.units,
  };
}
