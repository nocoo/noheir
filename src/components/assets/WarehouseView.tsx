/**
 * Warehouse View Page
 *
 * "The Warehouse View" - A dedicated page for visualizing capital units as a warehouse
 * with waffle chart showing inventory status at a glance
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUnitsDisplay, useUpdateUnit, useDeployUnit, useRecallUnit, useProducts } from '@/hooks/useAssets';
import { WarehouseWaffleChart } from './WarehouseWaffleChart';
import { UnifiedEditDeployDialog } from './CapitalUnitsManager';
import { TransactionHeatmap } from '@/components/dashboard/TransactionHeatmap';
import { Card } from '@/components/ui/card';
import { Boxes } from 'lucide-react';
import type { UnitDisplayInfo, UpdateCapitalUnitInput, DeployUnitInput } from '@/types/assets';
import { toast } from 'sonner';
import { useTransactions } from '@/hooks/useTransactions';

export function WarehouseView() {
  const { data: units, isLoading } = useUnitsDisplay();
  const { data: products } = useProducts();
  const { data: transactions } = useTransactions();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateUnit();
  const deployMutation = useDeployUnit();
  const recallMutation = useRecallUnit();

  const [editDeployDialog, setEditDeployDialog] = useState<{
    open: boolean;
    unit?: UnitDisplayInfo;
  }>({ open: false });

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="w-6 h-6" />
            仓库视图
          </h1>
          <p className="text-muted-foreground">
            可视化资金单元库存状态 - 每个方块代表一个资金单元
          </p>
        </div>
      </div>

      {/* Main Content - Single Card Container for Heatmap and Waffle Chart */}
      {units && units.length > 0 && (
        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Heatmap Section (if transactions exist) */}
          {transactions && transactions.length > 0 && (
            <div className="border-b">
              <TransactionHeatmap
                transactions={transactions}
                year={new Date().getFullYear()}
                type="expense"
                embedded={true}
              />
            </div>
          )}

          {/* Waffle Chart Section */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6">
            <WarehouseWaffleChart units={units} onUnitClick={handleUnitClick} />
          </div>
        </Card>
      )}

      {/* Edit/Deploy Dialog */}
      <UnifiedEditDeployDialog
        open={editDeployDialog.open}
        onClose={handleCloseDialog}
        onUnitUpdate={handleUnitUpdate}
        onDeployConfirm={handleDeployConfirm}
        onRecall={handleRecall}
        unit={editDeployDialog.unit || null}
        products={products || []}
        isPending={updateMutation.isPending || deployMutation.isPending}
      />
    </div>
  );
}
