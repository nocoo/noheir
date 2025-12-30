/**
 * Warehouse Waffle Chart Component
 *
 * "The Warehouse View" - Visualizes capital units as a 10x10 grid (100 units max)
 * Each cell represents one capital unit (50k) with color-coded status
 */

import { useState, useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UnitDisplay, UnitStatus, Currency } from '@/types/assets';
import { formatCurrencyFull } from '@/lib/chart-config';

// Currency emoji
const CURRENCY_EMOJI: Record<Currency, string> = {
  CNY: '🇨🇳',
  USD: '🇺🇸',
  HKD: '🇭🇰',
};

// ============================================================================
// TYPES
// ============================================================================

type WaffleStatus =
  | 'idle'           // 🔴 红色 - 闲置 (已成立但无产品)
  | 'locked-long'    // 🟢 深绿 - 锁定 > 1 年
  | 'locked-short'   // 🟢 浅绿 - 锁定 < 3 个月
  | 'locked-medium'  // 🟡 黄色 - 锁定 3个月-1年
  | 'archived';      // ⚪️ 灰色 - 已归档/已消费

interface WaffleUnit extends UnitDisplay {
  waffleStatus: WaffleStatus;
}

// ============================================================================
// STATUS CLASSIFICATION
// ============================================================================

function classifyUnitStatus(unit: UnitDisplay): WaffleStatus {
  // 已归档
  if (unit.status === '已归档') return 'archived';
  if (unit.status === '计划中') return 'archived';
  if (unit.status === '筹集中') return 'archived';

  // 闲置：已成立但没有关联产品
  if (unit.status === '已成立' && !unit.product) return 'idle';

  // 检查锁定期
  if (unit.end_date) {
    const daysUntilMaturity = unit.days_until_maturity;
    const today = new Date();
    const endDate = new Date(unit.end_date);
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    // 已过期或即将过期（< 7天）视为短期
    if (daysUntilMaturity !== undefined && daysUntilMaturity < 7) return 'locked-short';

    // 锁定超过1年
    if (totalDays > 365) return 'locked-long';

    // 锁定少于3个月
    if (totalDays <= 90) return 'locked-short';

    // 中期锁定
    return 'locked-medium';
  }

  // 已成立但无到期日，视为闲置
  return 'idle';
}

// ============================================================================
// WAFFLE CELL COMPONENT
// ============================================================================

interface WaffleCellProps {
  unit: WaffleUnit;
  index: number;
}

function WaffleCell({ unit, index }: WaffleCellProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getStatusColor = (status: WaffleStatus): string => {
    switch (status) {
      case 'idle':
        return 'bg-rose-500 dark:bg-rose-600 hover:bg-rose-600 dark:hover:bg-rose-500';
      case 'locked-long':
        return 'bg-emerald-700 dark:bg-emerald-800 hover:bg-emerald-600 dark:hover:bg-emerald-700';
      case 'locked-short':
        return 'bg-emerald-400 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400';
      case 'locked-medium':
        return 'bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-500';
      case 'archived':
        return 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600';
      default:
        return 'bg-slate-300 dark:bg-slate-700';
    }
  };

  const getStatusLabel = (status: WaffleStatus): string => {
    switch (status) {
      case 'idle': return '闲置';
      case 'locked-long': return '长期锁定';
      case 'locked-short': return '短期锁定';
      case 'locked-medium': return '中期锁定';
      case 'archived': return '已归档';
      default: return '未知';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip open={isHovered} onOpenChange={setIsHovered}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'h-8 rounded-sm transition-all duration-200 cursor-pointer',
              'border border-border/50 hover:scale-110 hover:shadow-md hover:z-10',
              getStatusColor(unit.waffleStatus)
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs space-y-2"
          sideOffset={10}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold text-lg">{unit.unit_code}</span>
              <Badge variant="outline" className="text-xs">
                {getStatusLabel(unit.waffleStatus)}
              </Badge>
            </div>

            <div className="flex items-baseline gap-1 text-sm">
              <span>{CURRENCY_EMOJI[unit.currency]}</span>
              <span className="font-semibold">{formatCurrencyFull(unit.amount)}</span>
            </div>

            {unit.product ? (
              <div className="text-xs text-muted-foreground">
                产品: {unit.product.name}
              </div>
            ) : (
              <div className="text-xs text-rose-600 dark:text-rose-400">
                ⚠️ 待投放
              </div>
            )}

            {unit.end_date && (
              <div className="text-xs text-muted-foreground">
                到期: {new Date(unit.end_date).toLocaleDateString('zh-CN')}
              </div>
            )}

            {unit.days_until_maturity !== undefined && unit.days_until_maturity >= 0 && (
              <div className="text-xs">
                {unit.days_until_maturity === 0 ? '今日到期' :
                 unit.days_until_maturity === 1 ? '明天到期' :
                 `${unit.days_until_maturity} 天后到期`}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// LEGEND COMPONENT
// ============================================================================

interface WaffleLegendProps {
  data: WaffleUnit[];
}

function WaffleLegend({ data }: WaffleLegendProps) {
  const stats = useMemo(() => {
    return {
      idle: data.filter(u => u.waffleStatus === 'idle').length,
      lockedLong: data.filter(u => u.waffleStatus === 'locked-long').length,
      lockedShort: data.filter(u => u.waffleStatus === 'locked-short').length,
      lockedMedium: data.filter(u => u.waffleStatus === 'locked-medium').length,
      archived: data.filter(u => u.waffleStatus === 'archived').length,
    };
  }, [data]);

  const legendItems = [
    {
      status: 'idle' as WaffleStatus,
      label: '闲置',
      color: 'bg-rose-500 dark:bg-rose-600',
      count: stats.idle,
      emoji: '🔴',
    },
    {
      status: 'locked-long' as WaffleStatus,
      label: '长期锁定 (>1年)',
      color: 'bg-emerald-700 dark:bg-emerald-800',
      count: stats.lockedLong,
      emoji: '🟢',
    },
    {
      status: 'locked-medium' as WaffleStatus,
      label: '中期锁定 (3月-1年)',
      color: 'bg-amber-500 dark:bg-amber-600',
      count: stats.lockedMedium,
      emoji: '🟡',
    },
    {
      status: 'locked-short' as WaffleStatus,
      label: '短期锁定 (<3月)',
      color: 'bg-emerald-400 dark:bg-emerald-500',
      count: stats.lockedShort,
      emoji: '🟢',
    },
    {
      status: 'archived' as WaffleStatus,
      label: '已归档',
      color: 'bg-slate-300 dark:bg-slate-700',
      count: stats.archived,
      emoji: '⚪️',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {legendItems.map(item => (
        <div key={item.status} className="flex items-center gap-1.5">
          <div className={cn('w-3 h-3 rounded-sm', item.color)} />
          <span className="text-muted-foreground">
            {item.emoji} {item.label}
          </span>
          <Badge variant="secondary" className="text-xs">
            {item.count}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN WAFFLE CHART COMPONENT
// ============================================================================

interface WarehouseWaffleChartProps {
  units: UnitDisplay[];
}

export function WarehouseWaffleChart({ units }: WarehouseWaffleChartProps) {
  // Classify units by status
  const waffleData = useMemo(() => {
    return units.map(unit => ({
      ...unit,
      waffleStatus: classifyUnitStatus(unit),
    }));
  }, [units]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = waffleData.length;
    const idle = waffleData.filter(u => u.waffleStatus === 'idle').length;
    const deployed = total - idle;
    const utilizationRate = total > 0 ? ((deployed / total) * 100).toFixed(1) : '0.0';

    return {
      total,
      idle,
      deployed,
      utilizationRate,
    };
  }, [waffleData]);

  // Handle empty state
  if (waffleData.length === 0) {
    return (
      <div className="border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">仓库视图</h3>
        </div>
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-4xl mb-4">📦</div>
          <p>暂无资金单元</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">仓库视图</h3>
          <p className="text-sm text-muted-foreground">
            每个方块代表一个资金单元，共 {stats.total} 个单元
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold">
              {stats.deployed} <span className="text-sm font-normal text-muted-foreground">/ {stats.total}</span>
            </p>
            <p className="text-xs text-muted-foreground">已投放单元</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{stats.utilizationRate}%</p>
            <p className="text-xs text-muted-foreground">资金利用率</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div>
        <WaffleLegend data={waffleData} />
      </div>

      {/* Warning for idle units */}
      {stats.idle > 0 && (
        <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900">
          <span>⚠️</span>
          <span>
            有 <strong>{stats.idle}</strong> 个资金单元闲置中，总金额{' '}
            <strong>
              {formatCurrencyFull(
                waffleData
                  .filter(u => u.waffleStatus === 'idle')
                  .reduce((sum, u) => sum + u.amount, 0)
              )}
            </strong>
          </span>
        </div>
      )}

      {/* Waffle Grid - All units */}
      <div className="py-4">
        <div
          className="grid gap-1.5 p-4 bg-muted/30 rounded-lg border w-full"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(2rem, 1fr))',
          }}
        >
          {waffleData.map((unit, index) => (
            <WaffleCell
              key={unit.id}
              unit={unit}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
