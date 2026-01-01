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
  | 'idle'           // 🔴 红色 - 闲置 (已成立但无产品)
  | 'locked-long'    // 🟢 深绿 - 锁定 > 1 年
  | 'locked-short'   // 🟢 浅绿 - 锁定 < 3 个月
  | 'locked-medium'  // 🟡 黄色 - 锁定 3个月-1年
  | 'planned'        // 🔵 蓝色 - 计划中
  | 'archived';      // ⚪️ 灰色 - 已归档/已消费

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

type WaffleStatus =
  | 'idle'           // 🔴 红色 - 闲置 (已成立但无产品)
  | 'locked-long'    // 🟢 深绿 - 锁定 > 1 年
  | 'locked-short'   // 🟢 浅绿 - 锁定 < 3 个月
  | 'locked-medium'  // 🟡 黄色 - 锁定 3个月-1年
  | 'planned'        // 🔵 蓝色 - 计划中
  | 'archived';      // ⚪️ 灰色 - 已归档/已消费

interface WaffleUnit extends UnitDisplay {
  waffleStatus: WaffleStatus;
}

// ============================================================================
// STATUS CLASSIFICATION
// ============================================================================

function classifyUnitStatus(unit: UnitDisplay): WaffleStatus {
  // 计划中 - 单独显示为蓝色
  if (unit.status === '计划中') return 'planned';

  // 筹集中
  if (unit.status === '筹集中') return 'archived';

  // 已归档
  if (unit.status === '已归档') return 'archived';

  // 闲置判断1：已成立但没有关联产品
  if (unit.status === '已成立' && !unit.product) return 'idle';

  // 闲置判断2：已成立且关联的是"现金+"类产品
  if (unit.status === '已成立' && unit.product?.category === '现金+') return 'idle';

  // 闲置判断3：已到期（需要提醒更新数据）
  if (unit.status === '已成立' && unit.is_overdue) return 'idle';

  // 检查锁定期
  if (unit.end_date) {
    const daysUntilMaturity = unit.days_until_maturity;
    const today = new Date();
    const endDate = new Date(unit.end_date);
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    // 已过期或即将过期（< 7天）视为短期
    if (daysUntilMaturity !== undefined && daysUntilMaturity < 0) return 'idle';

    // 锁定超过1年
    if (totalDays > 365) return 'locked-long';

    // 锁定少于3个月
    if (totalDays <= 90) return 'locked-short';

    // 中期锁定
    return 'locked-medium';
  }

  // 已成立、有产品、无到期日（如随时可赎回产品）视为短期锁定
  return 'locked-short';
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
      case 'planned':
        return 'bg-slate-400 dark:bg-slate-600 hover:bg-slate-500 dark:hover:bg-slate-500';
      case 'archived':
        return 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600';
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
              getStatusColor(unit.waffleStatus)
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
      planned: data.filter(u => u.waffleStatus === 'planned').length,
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
      status: 'planned' as WaffleStatus,
      label: '待筹集',
      color: 'bg-slate-400 dark:bg-slate-600',
      count: stats.planned,
      emoji: '⚪',
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
    <div className="space-y-6">
      {/* Header */}
      <div className="border rounded-xl p-6 space-y-4">
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
                      .filter(u => u.waffleStatus === 'idle')
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
                <li>已到期产品（需要更新数据或自动续期）</li>
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
          className="grid gap-1.5 p-4 bg-muted/30 rounded-lg border w-full"
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
