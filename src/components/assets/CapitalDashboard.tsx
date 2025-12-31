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
  Eye,
  EyeOff,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/chart-config';
import type { InvestmentStrategy, Currency, UnitStatus } from '@/types/assets';

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
// CURRENCY DISTRIBUTION CHART
// ============================================================================

interface CurrencyChartProps {
  data: Array<{
    currency: Currency;
    amount: number;
    percentage: number;
  }>;
}

const CURRENCY_COLORS: Record<Currency, string> = {
  CNY: '#ef4444',  // red
  USD: '#3b82f6',  // blue
  HKD: '#f59e0b',  // amber
};

function CurrencyChart({ data }: CurrencyChartProps) {
  const chartData = data.map(item => ({
    name: item.currency,
    value: item.amount,
    percentage: item.percentage,
    color: CURRENCY_COLORS[item.currency],
    emoji: CURRENCY_EMOJI[item.currency],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{data.emoji} {data.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrencyFull(data.value)} ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="border rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold">币种分布</h3>

      <div className="flex items-stretch gap-4">
        {/* Chart */}
        <div className="w-[70%] h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="w-[30%] space-y-1.5">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-2 p-1.5 rounded whitespace-nowrap"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-sm font-medium truncate">{item.emoji} {item.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
                <p className="text-sm font-bold">{formatCurrencyFull(item.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STATUS DISTRIBUTION CHART
// ============================================================================

interface StatusChartProps {
  data: Array<{
    status: UnitStatus;
    amount: number;
    percentage: number;
  }>;
}

const STATUS_COLORS: Record<UnitStatus, string> = {
  '已成立': '#10b981',  // emerald
  '计划中': '#3b82f6',  // blue
  '筹集中': '#f59e0b',  // amber
  '已归档': '#6b7280',  // gray
};

function StatusChart({ data }: StatusChartProps) {
  const chartData = data.map(item => ({
    name: item.status,
    value: item.amount,
    percentage: item.percentage,
    color: STATUS_COLORS[item.status],
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
        </div>
      );
    }
    return null;
  };

  return (
    <div className="border rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold">状态分布</h3>

      <div className="flex items-stretch gap-4">
        {/* Chart */}
        <div className="w-[70%] h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="w-[30%] space-y-1.5">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-2 p-1.5 rounded whitespace-nowrap"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-sm font-medium truncate">{item.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
                <p className="text-sm font-bold">{formatCurrencyFull(item.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MATURITY DISTRIBUTION CHART
// ============================================================================

interface MaturityChartProps {
  data: Array<{
    period: string;
    amount: number;
    percentage: number;
  }>;
}

const MATURITY_COLORS: Record<string, string> = {
  '已到期': '#ef4444',    // red
  '7天内': '#f97316',     // orange
  '30天内': '#f59e0b',    // amber
  '90天内': '#3b82f6',    // blue
  '90天以上': '#10b981',  // emerald
};

function MaturityChart({ data }: MaturityChartProps) {
  const chartData = data.map(item => ({
    name: item.period,
    value: item.amount,
    percentage: item.percentage,
    color: MATURITY_COLORS[item.period],
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
        </div>
      );
    }
    return null;
  };

  return (
    <div className="border rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold">到期时间分布</h3>

      <div className="flex items-stretch gap-4">
        {/* Chart */}
        <div className="w-[70%] h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="w-[30%] space-y-1.5">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between gap-2 p-1.5 rounded whitespace-nowrap"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-sm font-medium truncate">{item.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
                <p className="text-sm font-bold">{formatCurrencyFull(item.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
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

      <div className="flex items-stretch gap-4">
        {/* Chart */}
        <div className="w-[70%] h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={120}
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
        <div className="w-[30%] space-y-1.5">
          {chartData.map((item) => (
            <div
              key={item.name}
              className={cn(
                "flex items-center justify-between gap-2 p-1.5 rounded cursor-pointer transition-colors whitespace-nowrap",
                selectedStrategy && selectedStrategy !== item.name ? "opacity-30" : "hover:bg-muted/50",
                !selectedStrategy && "hover:bg-muted/50"
              )}
              onClick={() => onStrategyClick?.(
                selectedStrategy === item.name ? null : item.name as InvestmentStrategy
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-sm font-medium truncate">{item.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
                <p className="text-sm font-bold">{formatCurrencyFull(item.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
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

  // Currency distribution
  const currencyDistribution = useMemo(() => {
    if (!units) return [];
    const currencyMap: Record<string, number> = {};
    units.forEach(u => {
      currencyMap[u.currency] = (currencyMap[u.currency] || 0) + u.amount;
    });
    return Object.entries(currencyMap).map(([currency, amount]) => ({
      currency: currency as Currency,
      amount,
      percentage: totalAssetsAll > 0 ? (amount / totalAssetsAll) * 100 : 0,
    }));
  }, [units, totalAssetsAll]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    if (!units) return [];
    const statusMap: Record<string, number> = {};
    units.forEach(u => {
      statusMap[u.status] = (statusMap[u.status] || 0) + u.amount;
    });
    return Object.entries(statusMap).map(([status, amount]) => ({
      status: status as UnitStatus,
      amount,
      percentage: totalAssetsAll > 0 ? (amount / totalAssetsAll) * 100 : 0,
    }));
  }, [units, totalAssetsAll]);

  // Maturity timeline distribution
  const maturityDistribution = useMemo(() => {
    if (!units) return [];
    const buckets = {
      '已到期': 0,
      '7天内': 0,
      '30天内': 0,
      '90天内': 0,
      '90天以上': 0,
    };

    units.forEach(u => {
      if (!u.end_date || u.status !== '已成立') return;
      if (u.is_overdue) {
        buckets['已到期'] += u.amount;
      } else if (u.days_until_maturity !== undefined) {
        if (u.days_until_maturity <= 7) {
          buckets['7天内'] += u.amount;
        } else if (u.days_until_maturity <= 30) {
          buckets['30天内'] += u.amount;
        } else if (u.days_until_maturity <= 90) {
          buckets['90天内'] += u.amount;
        } else {
          buckets['90天以上'] += u.amount;
        }
      }
    });

    return Object.entries(buckets)
      .filter(([_, amount]) => amount > 0)
      .map(([period, amount]) => ({
        period,
        amount,
        percentage: totalAssetsAll > 0 ? (amount / totalAssetsAll) * 100 : 0,
      }));
  }, [units, totalAssetsAll]);

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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strategy Distribution */}
        {dashboardData?.strategy_allocation && (
          <StrategyChart
            data={dashboardData.strategy_allocation}
            totalAssets={totalAssetsAll}
            selectedStrategy={selectedStrategy}
            onStrategyClick={setSelectedStrategy}
          />
        )}

        {/* Currency Distribution */}
        <CurrencyChart data={currencyDistribution} />

        {/* Status Distribution */}
        <StatusChart data={statusDistribution} />

        {/* Maturity Distribution */}
        <MaturityChart data={maturityDistribution} />
      </div>
    </div>
  );
}
