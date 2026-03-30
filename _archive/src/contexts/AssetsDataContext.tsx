/**
 * Assets Data Context
 *
 * 统一的资金和产品数据管理层
 * - 在整个应用中维护一份数据
 * - 自动缓存和同步
 * - 提供高效的数据访问方法
 */

import { createContext, useContext, ReactNode } from 'react';
import { useProducts, useUnitsDisplay, useAssetDashboard } from '@/hooks/useAssets';
import type { ProductDisplay, UnitDisplay } from '@/types/assets';

// ============================================================================
// TYPES
// ============================================================================

interface AssetsData {
  // 产品数据
  products: ProductDisplay[] | undefined;
  productsLoading: boolean;
  productsError: Error | null;

  // 资金单元数据
  units: UnitDisplay[] | undefined;
  unitsLoading: boolean;
  unitsError: Error | null;

  // 仪表盘数据
  dashboardData: ReturnType<typeof useAssetDashboard>['data'];
  dashboardLoading: boolean;
  dashboardError: Error | null;

  // 整体加载状态
  isLoading: boolean;
  isReady: boolean;
}

interface AssetsDataContextValue extends AssetsData {
  // 可以在这里添加刷新方法等
  refetch: () => Promise<void>;
}

const AssetsDataContext = createContext<AssetsDataContextValue | null>(null);

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface AssetsDataProviderProps {
  children: ReactNode;
}

export function AssetsDataProvider({ children }: AssetsDataProviderProps) {
  // 获取产品数据
  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
  } = useProducts();

  // 获取资金单元数据
  const {
    data: units,
    isLoading: unitsLoading,
    error: unitsError,
  } = useUnitsDisplay();

  // 获取仪表盘数据
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useAssetDashboard();

  // 整体加载状态
  const isLoading = productsLoading || unitsLoading || dashboardLoading;
  const isReady = !isLoading && !!products && !!units;

  // 统一刷新方法
  const refetch = async () => {
    // React Query 会自动处理缓存失效
    // 这里可以添加手动刷新逻辑
    Promise.resolve();
  };

  const value: AssetsDataContextValue = {
    products,
    productsLoading,
    productsError,
    units,
    unitsLoading,
    unitsError,
    dashboardData,
    dashboardLoading,
    dashboardError,
    isLoading,
    isReady,
    refetch,
  };

  return (
    <AssetsDataContext.Provider value={value}>
      {children}
    </AssetsDataContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * 使用统一资产数据
 *
 * @example
 * const { products, units, isLoading } = useAssetsData();
 */
export function useAssetsData(): AssetsDataContextValue {
  const context = useContext(AssetsDataContext);
  if (!context) {
    throw new Error('useAssetsData must be used within AssetsDataProvider');
  }
  return context;
}

// ============================================================================
// HELPER HOOKS（可选，提供更便捷的访问）
// ============================================================================

/**
 * 仅获取产品数据
 */
export function useProductsData() {
  const { products, productsLoading, productsError } = useAssetsData();
  return { products, isLoading: productsLoading, error: productsError };
}

/**
 * 仅获取资金单元数据
 */
export function useUnitsData() {
  const { units, unitsLoading, unitsError } = useAssetsData();
  return { units, isLoading: unitsLoading, error: unitsError };
}

/**
 * 仅获取仪表盘数据
 */
export function useDashboardData() {
  const { dashboardData, dashboardLoading, dashboardError } = useAssetsData();
  return { dashboardData, isLoading: dashboardLoading, error: dashboardError };
}
