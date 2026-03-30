import { useMemo, useState } from 'react';
import {
  useUnitsDisplay,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  useDeployUnit,
  useRecallUnit,
  useArchiveUnit,
  useProducts,
} from '@/hooks/useAssets';
import { useFilteredAndSorted } from '@/hooks/useFilteredAndSorted';
import type {
  CapitalUnit,
  CreateCapitalUnitInput,
  UpdateCapitalUnitInput,
  DeployUnitInput,
  FinancialProduct,
  InvestmentStrategy,
  InvestmentTactics,
  UnitDisplayInfo,
  UnitStatus,
} from '@/types/assets';

export type UnitSortField = 'unit_code' | 'amount' | 'currency' | 'strategy' | 'tactics' | 'status' | 'remaining_days';

export function useCapitalUnitsManagerViewModel() {
  const { data: units, isLoading } = useUnitsDisplay();
  const { data: products } = useProducts();
  const createMutation = useCreateUnit();
  const updateMutation = useUpdateUnit();
  const deleteMutation = useDeleteUnit();
  const deployMutation = useDeployUnit();
  const recallMutation = useRecallUnit();
  const archiveMutation = useArchiveUnit();

  const [filterStatus, setFilterStatus] = useState<UnitStatus | 'all'>('all');
  const [filterStrategy, setFilterStrategy] = useState<InvestmentStrategy | 'all'>('all');
  const [filterTactics, setFilterTactics] = useState<InvestmentTactics | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [sortField, setSortField] = useState<UnitSortField>('unit_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredUnits = useFilteredAndSorted({
    items: (units ?? []) as unknown as Record<string, unknown>[],
    filters: {
      status: filterStatus,
      strategy: filterStrategy,
      tactics: filterTactics,
    },
    sort: {
      field: sortField,
      order: sortOrder,
    },
    getValueCallback: (item, field) => {
      if (field === 'remaining_days') {
        return (item as unknown as UnitDisplayInfo).days_until_maturity ?? Infinity;
      }
      return (item as Record<string, unknown>)[field];
    },
  }) as unknown as UnitDisplayInfo[];

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== 'all') count++;
    if (filterStrategy !== 'all') count++;
    if (filterTactics !== 'all') count++;
    return count;
  }, [filterStatus, filterStrategy, filterTactics]);

  const resetFilters = () => {
    setFilterStatus('all');
    setFilterStrategy('all');
    setFilterTactics('all');
    setShowFilters(false);
  };

  const [formDialog, setFormDialog] = useState<{ open: boolean; unit?: CapitalUnit }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; unit?: CapitalUnit }>({ open: false });
  const [editDeployDialog, setEditDeployDialog] = useState<{ open: boolean; unit?: UnitDisplayInfo }>({ open: false });
  const [archiveDialog, setArchiveDialog] = useState<{ open: boolean; unit?: CapitalUnit }>({ open: false });

  const handleSort = (field: UnitSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortOrder = () => sortOrder;
  const getSortField = () => sortField;

  const handleCreate = (data: CreateCapitalUnitInput) => {
    createMutation.mutate(data, {
      onSuccess: () => setFormDialog({ open: false }),
    });
  };

  const handleUpdate = (data: UpdateCapitalUnitInput) => {
    if (!formDialog.unit) return;
    updateMutation.mutate(
      { id: formDialog.unit.id, input: data },
      { onSuccess: () => setFormDialog({ open: false }) }
    );
  };

  const handleDelete = () => {
    if (!deleteDialog.unit) return;
    deleteMutation.mutate(deleteDialog.unit.id, {
      onSuccess: () => setDeleteDialog({ open: false }),
    });
  };

  const handleEditDeploy = (unitData: UpdateCapitalUnitInput, deployData?: DeployUnitInput) => {
    if (!editDeployDialog.unit) return;

    if (deployData && deployData.product_id) {
      const deployInput = {
        ...deployData,
        strategy: unitData.strategy,
        tactics: unitData.tactics,
      } as unknown as DeployUnitInput;

      deployMutation.mutate(
        {
          unitId: editDeployDialog.unit.id,
          input: deployInput,
        },
        { onSuccess: () => setEditDeployDialog({ open: false }) }
      );
      return;
    }

    updateMutation.mutate(
      { id: editDeployDialog.unit.id, input: unitData },
      { onSuccess: () => setEditDeployDialog({ open: false }) }
    );
  };

  const handleRecallFromDialog = () => {
    if (!editDeployDialog.unit) return;
    recallMutation.mutate(editDeployDialog.unit.id, {
      onSuccess: () => setEditDeployDialog({ open: false }),
    });
  };

  const handleRecall = (unitId: string) => {
    recallMutation.mutate(unitId);
  };

  const handleArchive = () => {
    if (!archiveDialog.unit) return;
    archiveMutation.mutate(archiveDialog.unit.id, {
      onSuccess: () => setArchiveDialog({ open: false }) },
    );
  };

  return {
    units,
    products: products ?? ([] as FinancialProduct[]),
    isLoading,
    filteredUnits,
    filterStatus,
    filterStrategy,
    filterTactics,
    showFilters,
    activeFilterCount,
    setFilterStatus,
    setFilterStrategy,
    setFilterTactics,
    setShowFilters,
    resetFilters,
    handleSort,
    getSortField,
    getSortOrder,
    formDialog,
    deleteDialog,
    editDeployDialog,
    archiveDialog,
    setFormDialog,
    setDeleteDialog,
    setEditDeployDialog,
    setArchiveDialog,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleEditDeploy,
    handleRecallFromDialog,
    handleRecall,
    handleArchive,
    createMutation,
    updateMutation,
    deleteMutation,
    deployMutation,
    recallMutation,
    archiveMutation,
  };
}
