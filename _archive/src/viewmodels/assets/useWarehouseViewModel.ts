import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUnitsDisplay, useUpdateUnit, useDeployUnit, useRecallUnit, useProducts } from '@/hooks/useAssets';
import { useTransactions } from '@/hooks/useTransactions';
import type { UnitDisplayInfo, UpdateCapitalUnitInput, DeployUnitInput } from '@/types/assets';
import { toast } from 'sonner';

export function useWarehouseViewModel() {
  const { data: units, isLoading } = useUnitsDisplay();
  const { data: products } = useProducts();
  const { transactions } = useTransactions();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateUnit();
  const deployMutation = useDeployUnit();
  const recallMutation = useRecallUnit();

  const [editDeployDialog, setEditDeployDialog] = useState<{ open: boolean; unit?: UnitDisplayInfo }>({ open: false });

  const handleUnitClick = (unit: UnitDisplayInfo) => {
    setEditDeployDialog({ open: true, unit });
  };

  const handleCloseDialog = () => {
    setEditDeployDialog({ open: false });
  };

  const handleUnitUpdate = (data: UpdateCapitalUnitInput) => {
    if (!editDeployDialog.unit) return;
    updateMutation.mutate(
      { id: editDeployDialog.unit.id, input: data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['assets'] });
          setEditDeployDialog({ open: false });
          toast.success('资金单元已更新');
        },
      }
    );
  };

  const handleDeployConfirm = (data: DeployUnitInput) => {
    if (!editDeployDialog.unit) return;
    deployMutation.mutate(
      { unitId: editDeployDialog.unit.id, input: data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['assets'] });
          setEditDeployDialog({ open: false });
        },
      }
    );
  };

  const handleRecall = () => {
    if (!editDeployDialog.unit) return;
    recallMutation.mutate(editDeployDialog.unit.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['assets'] });
        setEditDeployDialog({ open: false });
        toast.success('资金已召回');
      },
    });
  };

  return {
    units,
    products,
    transactions,
    isLoading,
    editDeployDialog,
    handleUnitClick,
    handleCloseDialog,
    handleUnitUpdate,
    handleDeployConfirm,
    handleRecall,
    updateMutation,
    deployMutation,
  };
}
