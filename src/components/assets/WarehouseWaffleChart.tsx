/**
 * Warehouse Waffle Chart Component
 *
 * "The Warehouse View" - Visualizes capital units as a grid
 * Each cell represents one capital unit with color-coded status
 * Supports filtering by strategy or viewing all
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/colored-badge';
import type { UnitDisplay, UnitStatus, Currency, InvestmentStrategy } from '@/types/assets';
import { formatCurrencyFull } from '@/lib/chart-config';
import { staggerFastContainer, staggerFastItem } from '@/lib/animations';

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'all' | 'strategy';
type WaffleStatus =
  | 'idle-no-product'      // 🔴 红色 - 闲置（未关联产品）
  | 'idle-cash-plus'       // 🌸 淡红 - 现金+产品
  | 'available-earning'    // 🟢 绿色系 - 已过锁定期（可用+产生收益，按收益率深浅）
  | 'locked-earning'       // 🔵 蓝色系 - 锁定期内（产生收益，按收益率深浅）
  | 'planned'              // 🟡 黄色 - 计划中（资金为0）
  | 'fundraising'          // 🟠 橙色 - 筹集中（资金逐步到位）
  | 'archived';            // ⚪️ 灰色 - 已归档（完全消灭）

// Currency emoji
const CURRENCY_EMOJI: Record<Currency, string> = {
  CNY: '🇨🇳',
  USD: '🇺🇸',
  HKD: '🇭🇰',
};

// Strategy icons mapping
const STRATEGY_ICONS: Record<InvestmentStrategy, string> = {
  '远期理财': '👵',
  '美元资产': '🇺🇸',
  '36存单': '📋',
  '长期理财': '🔒',
  '短期理财': '⚡',
  '中期理财': '⏱️',
  '进攻计划': '🚀',
  '麻麻理财': '👶',
};

// ============================================================================
// TYPES
// ============================================================================

interface WaffleUnit extends UnitDisplay {
  waffleStatus: WaffleStatus;
}

// ============================================================================
// STATUS CLASSIFICATION
// ============================================================================

function classifyUnitStatus(unit: UnitDisplay): WaffleStatus {
  // 🟡 计划中 - 资金为0，尚未开始
  if (unit.status === '计划中') return 'planned';

  // 🟠 筹集中 - 资金逐步到位（如定投进行中）
  if (unit.status === '筹集中') return 'fundraising';

  // ⚪️ 已归档 - 完全消灭，不再存在
  if (unit.status === '已归档') return 'archived';

  // ❌ WORST: 已成立但没有关联产品 → 🔴 红色
  if (unit.status === '已成立' && !unit.product) return 'idle-no-product';

  // 🌸 淡红: 已成立且关联的是"现金+"类产品
  if (unit.status === '已成立' && unit.product?.category === '现金+') return 'idle-cash-plus';

  // ✅ BEST: 已过锁定期（可用+产生收益）→ 🟢 绿色系
  if (unit.status === '已成立' && unit.is_available) return 'available-earning';

  // 🔵 蓝色系: 锁定期内（产生收益）
  if (unit.status === '已成立' && unit.end_date) return 'locked-earning';

  // 默认：有产品但无到期日期（如随时可赎回产品）
  return 'available-earning';
}

// ============================================================================
// WAFFLE CELL COMPONENT
// ============================================================================

interface WaffleCellProps {
  unit: WaffleUnit;
  index: number;
  onUnitClick?: (unit: WaffleUnit) => void;
}

function WaffleCell({ unit, index, onUnitClick }: WaffleCellProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate color shade based on annual return rate
  const getReturnRateColor = (unit: WaffleUnit): string => {
    const rate = unit.product?.annual_return_rate;

    if (rate === undefined || rate === null) {
      // No rate info - use default color
      if (unit.waffleStatus === 'available-earning') return 'bg-green-500 dark:bg-green-600';
      if (unit.waffleStatus === 'locked-earning') return 'bg-blue-500 dark:bg-blue-600';
      return '';
    }

    // Color intensity based on return rate (0-10%)
    // Higher return = darker/more intense color
    const intensity = Math.min(Math.max(rate / 10, 0), 1); // Normalize to 0-1

    if (unit.waffleStatus === 'available-earning') {
      // Green series: 500 → 700 (light → dark)
      if (rate >= 8) return 'bg-green-700 dark:bg-green-800';      // High return
      if (rate >= 5) return 'bg-green-600 dark:bg-green-700';      // Medium-high
      if (rate >= 3) return 'bg-green-500 dark:bg-green-600';      // Medium
      return 'bg-green-400 dark:bg-green-500';                    // Low return
    }

    if (unit.waffleStatus === 'locked-earning') {
      // Blue series: 500 → 700 (light → dark)
      if (rate >= 8) return 'bg-blue-700 dark:bg-blue-800';       // High return
      if (rate >= 5) return 'bg-blue-600 dark:bg-blue-700';       // Medium-high
      if (rate >= 3) return 'bg-blue-500 dark:bg-blue-600';       // Medium
      return 'bg-blue-400 dark:bg-blue-500';                     // Low return
    }

    return '';
  };

  const getStatusColor = (unit: WaffleUnit): string => {
    const { waffleStatus } = unit;

    switch (waffleStatus) {
      case 'idle-no-product':
        // 🔴 Red - No product (worst)
        return 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600';

      case 'idle-cash-plus':
        // 🌸 Light red/pink - Cash+ products
        return 'bg-pink-300 dark:bg-pink-400 hover:bg-pink-400 dark:hover:bg-pink-300';

      case 'available-earning':
        // 🟢 Green series - Available + earning (best)
        // Color intensity based on return rate
        return getReturnRateColor(unit) + ' hover:opacity-80';

      case 'locked-earning':
        // 🔵 Blue series - In lock period + earning
        // Color intensity based on return rate
        return getReturnRateColor(unit) + ' hover:opacity-80';

      case 'planned':
        // ⚪️ Gray - Planned (资金为0，尚未开始)
        return 'bg-gray-400 dark:bg-gray-500 hover:bg-gray-500 dark:hover:bg-gray-400';

      case 'fundraising':
        // 🟡 Yellow - Fundraising (资金逐步到位)
        return 'bg-yellow-500 dark:bg-yellow-600 hover:bg-yellow-600 dark:hover:bg-yellow-500';

      case 'archived':
        // ⚫️ Slate - Archived (完全消灭)
        return 'bg-slate-400 dark:bg-slate-600 hover:bg-slate-500 dark:hover:bg-slate-500';

      default:
        return 'bg-slate-300 dark:bg-slate-700';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip open={isHovered} onOpenChange={setIsHovered}>
        <TooltipTrigger asChild>
          <motion.div
            variants={staggerFastItem}
            whileHover={{ scale: 1.1, zIndex: 10, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'h-12 rounded-sm transition-all duration-200 cursor-pointer relative',
              'border border-border/50 hover:shadow-md',
              getStatusColor(unit)
            )}
            onClick={() => onUnitClick?.(unit)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white/90 dark:text-white/95 pointer-events-none">
              {unit.unit_code}
            </span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs space-y-2 bg-white dark:bg-slate-900"
          sideOffset={10}
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold text-lg">{unit.unit_code}</span>
              <StatusBadge status={unit.status} />
            </div>

            <div className="flex items-baseline gap-1 text-sm">
              <span>{CURRENCY_EMOJI[unit.currency]}</span>
              <span className="font-semibold">{formatCurrencyFull(unit.amount)}</span>
            </div>

            {unit.product ? (
              <div className="text-xs text-muted-foreground">
                产品: {unit.product.name}
              </div>
            ) : unit.status === '计划中' ? (
              <div className="text-xs text-muted-foreground">
                ⏳ 待筹集
              </div>
            ) : (
              <div className="text-xs text-rose-600 dark:text-rose-400">
                ⚠️ 待投放
              </div>
            )}

            {unit.end_date && (
              <div className="text-xs text-muted-foreground">
                解锁: {new Date(unit.end_date).toLocaleDateString('zh-CN')}
              </div>
            )}

            {unit.days_until_maturity !== undefined && unit.days_until_maturity >= 0 && (
              <div className="text-xs">
                {unit.days_until_maturity === 0 ? '今日解锁' :
                 unit.days_until_maturity === 1 ? '明天解锁' :
                 `${unit.days_until_maturity} 天后解锁`}
              </div>
            )}

            {unit.is_available && unit.days_until_maturity !== undefined && (
              <div className="text-xs text-income">
                ✅ 已可用 {Math.abs(unit.days_until_maturity)} 天
              </div>
            )}

            {unit.note && (
              <div className="text-xs text-muted-foreground italic pt-1 border-t">
                📝 {unit.note}
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
      idleNoProduct: data.filter(u => u.waffleStatus === 'idle-no-product').length,
      idleCashPlus: data.filter(u => u.waffleStatus === 'idle-cash-plus').length,
      availableEarning: data.filter(u => u.waffleStatus === 'available-earning').length,
      lockedEarning: data.filter(u => u.waffleStatus === 'locked-earning').length,
      planned: data.filter(u => u.waffleStatus === 'planned').length,
      fundraising: data.filter(u => u.waffleStatus === 'fundraising').length,
      archived: data.filter(u => u.waffleStatus === 'archived').length,
    };
  }, [data]);

  const legendItems = [
    {
      status: 'idle-no-product' as WaffleStatus,
      label: '未关联产品',
      color: 'bg-red-600 dark:bg-red-700',
      count: stats.idleNoProduct,
      emoji: '🔴',
    },
    {
      status: 'idle-cash-plus' as WaffleStatus,
      label: '现金+产品',
      color: 'bg-pink-300 dark:bg-pink-400',
      count: stats.idleCashPlus,
      emoji: '🌸',
    },
    {
      status: 'locked-earning' as WaffleStatus,
      label: '锁定期内',
      color: 'bg-blue-500 dark:bg-blue-600',
      count: stats.lockedEarning,
      emoji: '🔵',
    },
    {
      status: 'available-earning' as WaffleStatus,
      label: '已可用',
      color: 'bg-green-500 dark:bg-green-600',
      count: stats.availableEarning,
      emoji: '🟢',
    },
    {
      status: 'planned' as WaffleStatus,
      label: '计划中',
      color: 'bg-gray-400 dark:bg-gray-500',
      count: stats.planned,
      emoji: '⚪️',
    },
    {
      status: 'fundraising' as WaffleStatus,
      label: '筹集中',
      color: 'bg-yellow-500 dark:bg-yellow-600',
      count: stats.fundraising,
      emoji: '🟡',
    },
    {
      status: 'archived' as WaffleStatus,
      label: '已归档',
      color: 'bg-slate-400 dark:bg-slate-600',
      count: stats.archived,
      emoji: '⚫️',
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
  onUnitClick?: (unit: UnitDisplay) => void;
}

export function WarehouseWaffleChart({ units, onUnitClick }: WarehouseWaffleChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  // Classify units by status and sort by unit_code
  const waffleData = useMemo(() => {
    return units
      .map(unit => ({
        ...unit,
        waffleStatus: classifyUnitStatus(unit),
      }))
      .sort((a, b) => a.unit_code.localeCompare(b.unit_code, 'zh-CN'));
  }, [units]);

  // Group units by strategy and sort by unit_code within each group
  const strategyGroups = useMemo(() => {
    const groups: Record<InvestmentStrategy, typeof waffleData> = {} as any;

    waffleData.forEach(unit => {
      if (!groups[unit.strategy]) {
        groups[unit.strategy] = [];
      }
      groups[unit.strategy].push(unit);
    });

    // Sort units within each strategy group by unit_code
    Object.keys(groups).forEach(strategy => {
      groups[strategy].sort((a, b) => a.unit_code.localeCompare(b.unit_code, 'zh-CN'));
    });

    // Sort by predefined strategy order
    const strategyOrder: InvestmentStrategy[] = [
      '远期理财', '美元资产', '36存单', '长期理财', '中期理财', '短期理财', '进攻计划', '麻麻理财'
    ];

    return strategyOrder
      .filter(strategy => groups[strategy]?.length > 0)
      .map(strategy => ({
        strategy,
        units: groups[strategy],
        count: groups[strategy].length,
      }));
  }, [waffleData]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = waffleData.length;
    const idle = waffleData.filter(u =>
      u.waffleStatus === 'idle-no-product' ||
      u.waffleStatus === 'idle-cash-plus' ||
      u.waffleStatus === 'fundraising'  // 筹集中也算闲置
    ).length;
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
      <div className="text-center py-12 text-muted-foreground">
        <div className="text-4xl mb-4">📦</div>
        <p>暂无资金单元</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="space-y-4 shrink-0">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">仓库视图</h3>
            <p className="text-sm text-muted-foreground">
              每个方块代表一个资金单元，共 {stats.total} 个单元
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('all')}
              >
                全部视图
              </Button>
              <Button
                variant={viewMode === 'strategy' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('strategy')}
              >
                按战略分组
              </Button>
            </div>

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
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900">
              <span>⚠️</span>
              <span>
                有 <strong>{stats.idle}</strong> 个资金单元闲置中，总金额{' '}
                <strong>
                  {formatCurrencyFull(
                    waffleData
                      .filter(u =>
                        u.waffleStatus === 'idle-no-product' ||
                        u.waffleStatus === 'idle-cash-plus' ||
                        u.waffleStatus === 'fundraising'
                      )
                      .reduce((sum, u) => sum + u.amount, 0)
                  )}
                </strong>
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              <p><strong>闲置判定标准：</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>未关联产品（资金到位但未投放）</li>
                <li>关联的是"现金+"类产品（流动性高，需再配置）</li>
                <li>筹集中（资金逐步到位，如定投进行中）</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* All View - Single Warehouse */}
      {viewMode === 'all' && (
        <motion.div
          variants={staggerFastContainer}
          initial="initial"
          animate="animate"
          className="grid gap-1.5 p-4 bg-muted/30 rounded-lg border flex-1"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(3.5rem, 1fr))',
          }}
        >
          {waffleData.map((unit, index) => (
            <WaffleCell
              key={unit.id}
              unit={unit}
              index={index}
              onUnitClick={onUnitClick}
            />
          ))}
        </motion.div>
      )}

      {/* Strategy View - Multiple Warehouses */}
      {viewMode === 'strategy' && (
        <div className="space-y-6">
          {strategyGroups.map(({ strategy, units: strategyUnits, count }) => {
            const groupStats = {
              total: count,
              idle: strategyUnits.filter(u => u.waffleStatus === 'idle').length,
              deployed: strategyUnits.filter(u => u.waffleStatus !== 'idle' && u.waffleStatus !== 'archived').length,
            };

            return (
              <motion.div
                key={strategy}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-3"
              >
                {/* Strategy Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="space-y-1">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      {STRATEGY_ICONS[strategy]} {strategy}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {count} 个资金单元 · {groupStats.deployed} 已投放 · {groupStats.idle} 闲置
                    </p>
                  </div>
                </div>

                {/* Strategy Grid */}
                <motion.div
                  variants={staggerFastContainer}
                  initial="initial"
                  animate="animate"
                  className="grid gap-1.5 p-4 bg-muted/30 rounded-lg border w-full"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(3.5rem, 1fr))',
                  }}
                >
                  {strategyUnits.map((unit, index) => (
                    <WaffleCell
                      key={unit.id}
                      unit={unit}
                      index={index}
                      onUnitClick={onUnitClick}
                    />
                  ))}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
