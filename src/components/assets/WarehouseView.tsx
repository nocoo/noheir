/**
 * Warehouse View Page
 *
 * "The Warehouse View" - A dedicated page for visualizing capital units as a warehouse
 * with waffle chart showing inventory status at a glance
 */

import { useWarehouseViewModel } from '@/viewmodels/assets/useWarehouseViewModel';
import { WarehouseWaffleChart } from './WarehouseWaffleChart';
import { UnifiedEditDeployDialog } from './CapitalUnitsManager';
import { TransactionHeatmap } from '@/components/dashboard/TransactionHeatmap';
import { Card } from '@/components/ui/card';
import { Boxes } from 'lucide-react';

export function WarehouseView() {
  const {
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
  } = useWarehouseViewModel();

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
