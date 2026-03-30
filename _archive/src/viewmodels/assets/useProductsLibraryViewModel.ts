import { useMemo, useState } from 'react';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useUnitsDisplay } from '@/hooks/useAssets';
import { useFilteredAndSorted } from '@/hooks/useFilteredAndSorted';
import type {
  FinancialProduct,
  CreateFinancialProductInput,
  UpdateFinancialProductInput,
  ProductChannel,
  ProductCategory,
  Currency,
} from '@/types/assets';

export type ProductSortField = 'name' | 'channel' | 'category' | 'investStatus' | 'totalCapital' | 'lockPeriod' | 'annualReturn';

export function useProductsLibraryViewModel() {
  const { data: products, isLoading } = useProducts();
  const { data: units } = useUnitsDisplay();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const [filterChannel, setFilterChannel] = useState<ProductChannel | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<ProductCategory | 'all'>('all');
  const [filterCurrency, setFilterCurrency] = useState<Currency | 'all'>('all');
  const [filterInvestStatus, setFilterInvestStatus] = useState<'all' | '投资中' | '已退出'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [sortField, setSortField] = useState<ProductSortField>('investStatus');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [formDialog, setFormDialog] = useState<{ open: boolean; product?: FinancialProduct }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; product?: FinancialProduct }>({ open: false });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterChannel !== 'all') count++;
    if (filterCategory !== 'all') count++;
    if (filterCurrency !== 'all') count++;
    if (filterInvestStatus !== 'all') count++;
    return count;
  }, [filterChannel, filterCategory, filterCurrency, filterInvestStatus]);

  const productMetrics = useMemo(() => {
    if (!products || !units) return {} as Record<string, { totalCapital: number; activeUnitsCount: number; dailyReturn: number }>;

    const metrics: Record<string, { totalCapital: number; activeUnitsCount: number; dailyReturn: number }> = {};

    products.forEach(product => {
      const productUnits = units.filter(unit =>
        unit.product_id === product.id && (unit.status === '已成立' || unit.status === '筹集中')
      );
      const totalCapital = productUnits.reduce((sum, unit) => sum + unit.amount, 0);
      const activeUnitsCount = productUnits.length;
      const dailyReturn = product.annual_return_rate
        ? (product.annual_return_rate / 100) * totalCapital / 365
        : 0;

      metrics[product.id] = { totalCapital, activeUnitsCount, dailyReturn };
    });

    return metrics;
  }, [products, units]);

  const filteredProducts = useFilteredAndSorted({
    items: (products ?? []) as unknown as Record<string, unknown>[],
    filters: {
      channel: filterChannel,
      category: filterCategory,
      currency: filterCurrency,
      investStatus: filterInvestStatus,
    },
    sort: {
      field: sortField,
      order: sortOrder,
    },
    customFilter: (product, filters) => {
      const p = product as unknown as FinancialProduct;
      if (filters.channel !== 'all' && p.channel !== filters.channel) return false;
      if (filters.category !== 'all' && p.category !== filters.category) return false;
      if (filters.currency !== 'all' && p.currency !== filters.currency) return false;

      const metrics = productMetrics[p.id];
      const hasActiveUnits = metrics && metrics.activeUnitsCount > 0;
      const investStatus = hasActiveUnits ? '投资中' : '已退出';
      if (filters.investStatus !== 'all' && investStatus !== filters.investStatus) return false;
      return true;
    },
    getValueCallback: (product, field) => {
      const p = product as unknown as FinancialProduct;
      if (field === 'investStatus') {
        const metrics = productMetrics[p.id];
        return metrics && metrics.activeUnitsCount > 0 ? '投资中' : '已退出';
      }
      if (field === 'totalCapital') return productMetrics[p.id]?.totalCapital || 0;
      if (field === 'lockPeriod') return p.lock_period_days;
      if (field === 'annualReturn') return p.annual_return_rate || 0;
      return (p as unknown as Record<string, unknown>)[field];
    },
  }) as unknown as FinancialProduct[];

  const handleSort = (field: ProductSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const resetFilters = () => {
    setFilterChannel('all');
    setFilterCategory('all');
    setFilterCurrency('all');
    setFilterInvestStatus('all');
    setShowFilters(false);
  };

  const handleCreate = (data: CreateFinancialProductInput) => {
    createMutation.mutate(data, { onSuccess: () => setFormDialog({ open: false }) });
  };

  const handleUpdate = (data: UpdateFinancialProductInput) => {
    if (!formDialog.product) return;
    updateMutation.mutate(
      { id: formDialog.product.id, input: data },
      { onSuccess: () => setFormDialog({ open: false }) }
    );
  };

  const handleDelete = () => {
    if (!deleteDialog.product) return;
    deleteMutation.mutate(deleteDialog.product.id, { onSuccess: () => setDeleteDialog({ open: false }) });
  };

  return {
    products,
    units,
    isLoading,
    filteredProducts,
    productMetrics,
    filterChannel,
    filterCategory,
    filterCurrency,
    filterInvestStatus,
    showFilters,
    activeFilterCount,
    setFilterChannel,
    setFilterCategory,
    setFilterCurrency,
    setFilterInvestStatus,
    setShowFilters,
    handleSort,
    resetFilters,
    formDialog,
    deleteDialog,
    setFormDialog,
    setDeleteDialog,
    handleCreate,
    handleUpdate,
    handleDelete,
    createMutation,
    updateMutation,
    deleteMutation,
    sortField,
    sortOrder,
  };
}
