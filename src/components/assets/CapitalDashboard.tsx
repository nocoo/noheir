/**
 * Capital Dashboard Component
 *
 * "Capital Command Center" - Visual overview of capital units and their relation to products
 */

import { useState, useMemo } from 'react';
import { useAssetDashboard, useUnitsDisplay } from '@/hooks/useAssets';
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Calendar,
  DollarSign,
  Coins,
  Eye,
  EyeOff,
  Layers,
  Filter,
} from 'lucide-react';
import { WarehouseWaffleChart } from './WarehouseWaffleChart';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/chart-config';
import type { InvestmentStrategy, Currency, UnitStatus, InvestmentTactics } from '@/types/assets';

// ============================================================================
// TYPES
// ============================================================================

type GroupByOption = 'strategy' | 'tactics' | 'status' | 'currency';

// ============================================================================
// TYPES & HELPERS
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'success';
  action?: { label: string; count: number };
}

// Strategy colors for visualization
const STRATEGY_COLORS: Record<InvestmentStrategy, string> = {
  '远期理财': '#3b82f6',  // blue
  '美元资产': '#8b5cf6',  // purple
  '36存单': '#06b6d4',    // cyan
  '长期理财': '#10b981',  // emerald
  '短期理财': '#f59e0b',  // amber
  '中期理财': '#f97316',  // orange
  '进攻计划': '#ef4444',  // red
  '麻麻理财': '#ec4899',  // pink
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

// Currency emoji
const CURRENCY_EMOJI: Record<Currency, string> = {
  CNY: '🇨🇳',
  USD: '🇺🇸',
  HKD: '🇭🇰',
};

// ============================================================================
// ACTION BAR COMPONENT
// ============================================================================

function StatCard({ title, value, subtitle, icon: Icon, variant, action }: StatCardProps) {
  const variantStyles = {
    default: 'border-border',
    warning: 'border-amber-500/50 bg-amber-500/5',
    success: 'border-emerald-500/50 bg-emerald-500/5',
  };

  return (
    <div className={cn(
      'border rounded-xl p-5 space-y-3 transition-all hover:shadow-md',
      variantStyles[variant || 'default']
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action && (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-medium">
            {action.count} 个单元待操作
          </span>
        </div>
      )}
    </div>
  );
}

interface ActionBarProps {
  totalAssets: Record<Currency, number>;
  totalAssetsAll: number;
  deploymentRate: number;
  idleCount: number;
  idleAmount: number;
  incomingLiquidity: number;
  incomingCount: number;
}

function ActionBar({
  totalAssets,
  totalAssetsAll,
  deploymentRate,
  idleCount,
  idleAmount,
  incomingLiquidity,
  incomingCount,
}: ActionBarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Assets Card */}
      <StatCard
        title="总资产"
        value={formatCurrencyFull(totalAssetsAll)}
        subtitle={Object.entries(totalAssets)
          .filter(([_, amount]) => amount > 0)
          .map(([currency, amount]) => `${CURRENCY_EMOJI[currency as Currency]} ${formatCurrencyFull(amount)}`)
          .join(' · ') || '-'}
        icon={Wallet}
      />

      {/* Deployment Rate Card */}
      <StatCard
        title="资金利用率"
        value={`${deploymentRate.toFixed(1)}%`}
        subtitle={`${(100 - deploymentRate).toFixed(1)}% 待投放`}
        icon={TrendingUp}
        variant={idleCount > 0 ? 'warning' : 'success'}
        action={idleCount > 0 ? { label: '待投放', count: idleCount } : undefined}
      />

      {/* Incoming Liquidity Card */}
      <StatCard
        title="即将到期 (30天)"
        value={formatCurrencyFull(incomingLiquidity)}
        subtitle={`${incomingCount} 个资金单元`}
        icon={Calendar}
        variant={incomingCount > 0 ? 'default' : 'default'}
      />
    </div>
  );
}

// ============================================================================
// STRATEGY ALLOCATION CHART
// ============================================================================

interface StrategyChartProps {
  data: Array<{
    strategy: InvestmentStrategy;
    total_amount: number;
    unit_count: number;
    percentage: number;
  }>;
  totalAssets: number;
  onStrategyClick?: (strategy: InvestmentStrategy | null) => void;
  selectedStrategy: InvestmentStrategy | null;
}

function StrategyChart({ data, totalAssets, onStrategyClick, selectedStrategy }: StrategyChartProps) {
  const chartData = data.map(item => ({
    name: item.strategy,
    value: item.total_amount,
    count: item.unit_count,
    percentage: item.percentage,
    color: STRATEGY_COLORS[item.strategy],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrencyFull(data.value)} ({data.percentage.toFixed(1)}%)
          </p>
          <p className="text-xs text-muted-foreground">{data.count} 个单元</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">策略分布</h3>
        {selectedStrategy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStrategyClick?.(null)}
          >
            <EyeOff className="w-4 h-4 mr-1" />
            清除筛选
          </Button>
        )}
      </div>

      <div className="flex items-stretch gap-6">
        {/* Chart */}
        <div className="w-[60%] min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                onClick={(entry) => onStrategyClick?.(
                  selectedStrategy === entry.name ? null : entry.name as InvestmentStrategy
                )}
                className="cursor-pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={selectedStrategy && selectedStrategy !== entry.name ? 'transparent' : 'white'}
                    strokeWidth={2}
                    opacity={selectedStrategy && selectedStrategy !== entry.name ? 0.3 : 1}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="w-[40%] space-y-2">
          {chartData.map((item) => (
            <div
              key={item.name}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors",
                selectedStrategy && selectedStrategy !== item.name ? "opacity-30" : "hover:bg-muted/50",
                !selectedStrategy && "hover:bg-muted/50"
              )}
              onClick={() => onStrategyClick?.(
                selectedStrategy === item.name ? null : item.name as InvestmentStrategy
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm">
                  {STRATEGY_ICONS[item.name as InvestmentStrategy]} {item.name}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{formatCurrencyFull(item.value)}</p>
                <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// UNIT CARD COMPONENT
// ============================================================================

interface UnitCardProps {
  unit_code: string;
  amount: number;
  currency: Currency;
  status: UnitStatus;
  strategy: InvestmentStrategy;
  tactics: string;
  product_name?: string;
  end_date?: string;
  days_until_maturity?: number;
  is_overdue?: boolean;
  progress?: number;
  onClick: () => void;
}

function UnitCard({
  unit_code,
  amount,
  currency,
  status,
  strategy,
  tactics,
  product_name,
  end_date,
  days_until_maturity,
  is_overdue,
  progress,
  onClick,
}: UnitCardProps) {
  // Determine display status based on end_date
  const getDisplayStatus = () => {
    if (status === '已归档') return { text: '已归档', color: 'bg-gray-400', isLocked: false };
    if (status === '计划中') return { text: '计划中', color: 'bg-gray-400', isLocked: false };
    if (status === '筹集中') return { text: '筹集中', color: 'bg-gray-400', isLocked: false };
    // For '已成立' units, check if they have an end_date
    if (end_date) {
      if (is_overdue) return { text: '已到期', color: 'bg-red-500', isLocked: true };
      if (days_until_maturity !== undefined && days_until_maturity <= 7) {
        return { text: '即将到期', color: 'bg-amber-500', isLocked: true };
      }
      return { text: '锁定期', color: 'bg-emerald-500', isLocked: true };
    }
    return { text: '已成立', color: 'bg-amber-500', isLocked: false };
  };

  const displayStatus = getDisplayStatus();
  // A unit is idle only if it has no associated product
  const isIdle = !product_name;

  const getDaysRemainingText = () => {
    if (isIdle) return '待投放';
    if (!days_until_maturity && days_until_maturity !== 0) return '-';
    if (is_overdue) return '已到期';
    if (days_until_maturity === 0) return '今日到期';
    if (days_until_maturity === 1) return '明天到期';
    if (days_until_maturity < 7) return `${days_until_maturity}天后到期`;
    return `${days_until_maturity}天后到期`;
  };

  const getDaysRemainingColor = () => {
    if (isIdle) return 'text-muted-foreground';
    if (is_overdue) return 'text-expense';
    if (days_until_maturity !== undefined && days_until_maturity <= 7) return 'text-amber-600 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  return (
    <div
      onClick={onClick}
      className="border rounded-xl p-4 space-y-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-lg">{unit_code}</span>
        <div className="flex items-center gap-1.5">
          <div className={cn('w-2 h-2 rounded-full', displayStatus.color)} />
          <Badge variant="outline" className="text-xs">
            {displayStatus.text}
          </Badge>
        </div>
      </div>

      {/* Amount */}
      <div className="flex items-baseline gap-1">
        <span className="text-xs">{CURRENCY_EMOJI[currency]}</span>
        <span className="text-2xl font-bold">{formatCurrencyFull(amount)}</span>
      </div>

      {/* Strategy & Tactics */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-xs">
          {STRATEGY_ICONS[strategy]} {strategy}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {tactics}
        </Badge>
      </div>

      {/* Product Name */}
      <div className="text-sm text-muted-foreground truncate">
        {product_name || '等待投放...'}
      </div>

      {/* Progress / Footer */}
      {displayStatus.isLocked && progress !== undefined && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className={getDaysRemainingColor()}>{getDaysRemainingText()}</span>
            {end_date && (
              <span className="text-muted-foreground">
                {new Date(end_date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {isIdle && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Coins className="w-3 h-3" />
          <span>待投放资金</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UNIT MATRIX COMPONENT
// ============================================================================

interface UnitMatrixProps {
  units: Array<{
    id: string;
    unit_code: string;
    amount: number;
    currency: Currency;
    status: UnitStatus;
    strategy: InvestmentStrategy;
    tactics: string;
    product?: { name: string } | null;
    end_date?: string | null;
    days_until_maturity?: number;
    is_overdue?: boolean;
    progress?: number;
  }>;
  selectedStrategy: InvestmentStrategy | null;
  onUnitClick: (unitId: string) => void;
}

function UnitMatrix({ units, selectedStrategy, onUnitClick }: UnitMatrixProps) {
  const [groupBy, setGroupBy] = useState<GroupByOption>('strategy');

  // Calculate progress for locked units
  const unitsWithProgress = useMemo(() => {
    return units.map(unit => {
      if (unit.status === '锁定期' && unit.end_date) {
        const startDate = new Date(unit.end_date);
        startDate.setDate(startDate.getDate() - 180); // Approximate 6 months for display
        const endDate = new Date(unit.end_date);
        const today = new Date();
        const totalDays = endDate.getTime() - startDate.getTime();
        const elapsedDays = today.getTime() - startDate.getTime();
        const progress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
        return { ...unit, progress };
      }
      return unit;
    });
  }, [units]);

  // Filter by selected strategy (from chart)
  const filteredUnits = selectedStrategy
    ? unitsWithProgress.filter(u => u.strategy === selectedStrategy)
    : unitsWithProgress;

  // Group by selected option
  const groupedUnits = useMemo(() => {
    const groups: Record<string, typeof filteredUnits> = {};

    filteredUnits.forEach(unit => {
      let key: string;
      switch (groupBy) {
        case 'strategy':
          key = unit.strategy;
          break;
        case 'tactics':
          key = unit.tactics;
          break;
        case 'status':
          key = unit.status;
          break;
        case 'currency':
          key = unit.currency;
          break;
        default:
          key = '未分类';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(unit);
    });

    // Sort groups by name
    const sortedEntries = Object.entries(groups).sort((a, b) => {
      // Custom order for strategy
      if (groupBy === 'strategy') {
        const strategyOrder: InvestmentStrategy[] = [
          '远期理财', '美元资产', '36存单', '长期理财', '中期理财', '短期理财', '进攻计划', '麻麻理财'
        ];
        const aIndex = strategyOrder.indexOf(a[0] as InvestmentStrategy);
        const bIndex = strategyOrder.indexOf(b[0] as InvestmentStrategy);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
      }
      return a[0].localeCompare(b[0], 'zh-CN');
    });

    // Sort units within each group by unit_code
    sortedEntries.forEach(([_, units]) => {
      units.sort((a, b) => a.unit_code.localeCompare(b.unit_code, 'zh-CN', { numeric: true }));
    });

    return sortedEntries;
  }, [filteredUnits, groupBy]);

  // Count based on product association (idle = no product, invested = has product)
  const idleCount = filteredUnits.filter(u => !u.product && u.status === '已成立').length;
  const investedCount = filteredUnits.filter(u => u.product && u.status === '已成立').length;

  const getGroupIcon = (key: string) => {
    if (groupBy === 'strategy') {
      return STRATEGY_ICONS[key as InvestmentStrategy] || '📊';
    }
    if (groupBy === 'currency') {
      return CURRENCY_EMOJI[key as Currency] || '💰';
    }
    return '📁';
  };

  const getGroupColor = (key: string) => {
    if (groupBy === 'strategy') {
      return STRATEGY_COLORS[key as InvestmentStrategy] || '#6b7280';
    }
    return undefined;
  };

  return (
    <div className="border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold">
          资金矩阵
          {selectedStrategy && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              · {STRATEGY_ICONS[selectedStrategy]} {selectedStrategy}
            </span>
          )}
        </h3>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>已投放: {investedCount}</span>
            <span>待投放: {idleCount}</span>
          </div>

          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
            <SelectTrigger className="w-32">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strategy">按战略</SelectItem>
              <SelectItem value="tactics">按战术</SelectItem>
              <SelectItem value="status">按状态</SelectItem>
              <SelectItem value="currency">按币种</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredUnits.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>没有符合条件的资金单元</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedUnits.map(([groupKey, groupUnits]) => {
            const groupTotal = groupUnits.reduce((sum, u) => sum + u.amount, 0);
            const groupColor = getGroupColor(groupKey);

            return (
              <div key={groupKey} className="space-y-3">
                {/* Group Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {groupColor && (
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: groupColor }} />
                    )}
                    <span className="text-lg font-semibold">
                      {getGroupIcon(groupKey)} {groupKey}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {groupUnits.length} 个单元
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">
                    {formatCurrencyFull(groupTotal)}
                  </span>
                </div>

                {/* Group Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupUnits.map(unit => (
                    <UnitCard
                      key={unit.id}
                      unit_code={unit.unit_code}
                      amount={unit.amount}
                      currency={unit.currency}
                      status={unit.status}
                      strategy={unit.strategy}
                      tactics={unit.tactics}
                      product_name={unit.product?.name}
                      end_date={unit.end_date || undefined}
                      days_until_maturity={unit.days_until_maturity}
                      is_overdue={unit.is_overdue}
                      progress={unit.progress}
                      onClick={() => onUnitClick(unit.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LIQUIDITY TIMELINE COMPONENT
// ============================================================================

interface LiquidityTimelineProps {
  upcomingMaturities: Array<{
    unit_id: string;
    unit_code: string;
    product_name?: string;
    end_date: string;
    days_remaining: number;
    amount: number;
  }>;
  onUnitClick: (unitId: string) => void;
}

function LiquidityTimeline({ upcomingMaturities, onUnitClick }: LiquidityTimelineProps) {
  // Group by time period
  const today = new Date();

  const grouped = useMemo(() => {
    const expired = upcomingMaturities.filter(m => m.days_remaining < 0);
    const thisWeek = upcomingMaturities.filter(m => m.days_remaining >= 0 && m.days_remaining <= 7);
    const thisMonth = upcomingMaturities.filter(m => m.days_remaining > 7 && m.days_remaining <= 30);

    return { expired, thisWeek, thisMonth };
  }, [upcomingMaturities]);

  const TimelineGroup = ({
    title,
    items,
    icon: Icon,
    color,
  }: {
    title: string;
    items: typeof upcomingMaturities;
    icon: React.ElementType;
    color: string;
  }) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className={cn('w-4 h-4', color)} />
          <span>{title}</span>
          <Badge variant="outline" className="text-xs">{items.length}</Badge>
        </div>
        {items.map(item => (
          <button
            key={item.unit_id}
            onClick={() => onUnitClick(item.unit_id)}
            className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{item.unit_code}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {item.product_name || '未知产品'}
                </span>
              </div>
              <span className="text-sm font-medium">{formatCurrencyFull(item.amount)}</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
              <span>{new Date(item.end_date).toLocaleDateString('zh-CN')}</span>
              <span className={cn(
                item.days_remaining < 0 ? 'text-expense' :
                item.days_remaining <= 7 ? 'text-amber-600 dark:text-amber-400' :
                'text-muted-foreground'
              )}>
                {item.days_remaining < 0 ? '已到期' :
                 item.days_remaining === 0 ? '今日' :
                 item.days_remaining === 1 ? '明天' :
                 `${item.days_remaining}天后`}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const totalAmount = upcomingMaturities.reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">流动性时间线</h3>
        <span className="text-sm text-muted-foreground">
          {formatCurrencyFull(totalAmount)}
        </span>
      </div>

      {upcomingMaturities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>未来30天无资金到期</p>
        </div>
      ) : (
        <div className="space-y-4">
          <TimelineGroup
            title="已到期"
            items={grouped.expired}
            icon={AlertCircle}
            color="text-expense"
          />
          <TimelineGroup
            title="本周到期"
            items={grouped.thisWeek}
            icon={AlertCircle}
            color="text-amber-600 dark:text-amber-400"
          />
          <TimelineGroup
            title="本月到期"
            items={grouped.thisMonth}
            icon={Calendar}
            color="text-muted-foreground"
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export function CapitalDashboard() {
  const { data: dashboardData, isLoading: dashboardLoading } = useAssetDashboard();
  const { data: units, isLoading: unitsLoading } = useUnitsDisplay();
  const [selectedStrategy, setSelectedStrategy] = useState<InvestmentStrategy | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  // Calculate totals by currency
  const totalAssetsByCurrency = useMemo(() => {
    const totals: Record<string, number> = { CNY: 0, USD: 0, HKD: 0 };
    units?.forEach(u => {
      totals[u.currency] = (totals[u.currency] || 0) + u.amount;
    });
    return totals;
  }, [units]);

  const totalAssetsAll = useMemo(() => {
    return Object.values(totalAssetsByCurrency).reduce((sum, amount) => sum + amount, 0);
  }, [totalAssetsByCurrency]);

  // Deployment rate
  const deploymentRate = useMemo(() => {
    if (!dashboardData || dashboardData.total_assets === 0) return 0;
    return (dashboardData.invested_amount / dashboardData.total_assets) * 100;
  }, [dashboardData]);

  // Idle units - only count "已成立" units without associated product
  const idleUnits = useMemo(() => {
    return units?.filter(u => u.status === '已成立' && !u.product) || [];
  }, [units]);

  const idleCount = idleUnits.length;
  const idleAmount = idleUnits.reduce((sum, u) => sum + u.amount, 0);

  // Incoming liquidity
  const incomingLiquidity = useMemo(() => {
    return dashboardData?.upcoming_maturities.reduce((sum, m) => sum + m.amount, 0) || 0;
  }, [dashboardData]);

  const incomingCount = dashboardData?.upcoming_maturities.length || 0;

  if (dashboardLoading || unitsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">资金总览</h1>
          <p className="text-muted-foreground">可视化资金分配与产品关系</p>
        </div>
      </div>

      {/* Action Bar */}
      <ActionBar
        totalAssets={totalAssetsByCurrency as Record<Currency, number>}
        totalAssetsAll={totalAssetsAll}
        deploymentRate={deploymentRate}
        idleCount={idleCount}
        idleAmount={idleAmount}
        incomingLiquidity={incomingLiquidity}
        incomingCount={incomingCount}
      />

      {/* Strategy Chart & Timeline Row */}
      <div className="space-y-6">
        {dashboardData?.strategy_allocation && (
          <StrategyChart
            data={dashboardData.strategy_allocation}
            totalAssets={totalAssetsAll}
            selectedStrategy={selectedStrategy}
            onStrategyClick={setSelectedStrategy}
          />
        )}

        {dashboardData?.upcoming_maturities && (
          <LiquidityTimeline
            upcomingMaturities={dashboardData.upcoming_maturities}
            onUnitClick={setSelectedUnit}
          />
        )}
      </div>

      {/* Warehouse Waffle Chart */}
      {units && units.length > 0 && (
        <WarehouseWaffleChart
          units={units}
          onUnitClick={setSelectedUnit}
        />
      )}

      {/* Unit Matrix - Full Width */}
      {units && (
        <UnitMatrix
          units={units}
          selectedStrategy={selectedStrategy}
          onUnitClick={setSelectedUnit}
        />
      )}
    </div>
  );
}
