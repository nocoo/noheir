/**
 * Warehouse View Page
 *
 * "The Warehouse View" - A dedicated page for visualizing capital units as a warehouse
 * with waffle chart showing inventory status at a glance
 */

import { useUnitsDisplay } from '@/hooks/useAssets';
import { WarehouseWaffleChart } from './WarehouseWaffleChart';
import { Boxes } from 'lucide-react';

export function WarehouseView() {
  const { data: units, isLoading } = useUnitsDisplay();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="w-6 h-6" />
            仓库视图
          </h1>
          <p className="text-muted-foreground">
            可视化资金单元库存状态 - 每个方块代表一个资金单元 (5万)
          </p>
        </div>
      </div>

      {/* Waffle Chart */}
      {units && units.length > 0 && (
        <div className="flex-1 flex flex-col space-y-4 min-h-0">
          <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg border shrink-0">
            <p className="font-medium mb-2">📦 视角与价值</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>宏观视角：</strong>将资金单元视为"集装箱"，一眼看到整体库存状态</li>
              <li><strong>核心问题：</strong>快速识别闲置资金，回答"我有多少弹药在睡觉？"</li>
              <li><strong>颜色编码：</strong>红色=闲置警报，绿色=锁定中，灰色=已归档</li>
            </ul>
          </div>
          <div className="flex-1 min-h-0">
            <WarehouseWaffleChart units={units} />
          </div>
        </div>
      )}
    </div>
  );
}
