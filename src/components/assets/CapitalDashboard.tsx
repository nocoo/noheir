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
  Calendar,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCurrencyFull } from '@/lib/chart-config';
import type { InvestmentStrategy, Currency, UnitStatus } from '@/types/assets';
import { DistributionPieChart } from './DistributionPieChart';
import {
  STRATEGY_COLORS,
  CURRENCY_COLORS,
  STATUS_COLORS,
  MATURITY_COLORS,
} from '@/lib/colorPalette';
import { fadeInUp, gridContainer, gridItem } from '@/lib/animations';

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
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
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
    </motion.div>
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
    <motion.div
      variants={gridContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      <motion.div variants={gridItem}>
        <StatCard
          title="总资产"
          value={formatCurrencyFull(totalAssetsAll)}
          subtitle={Object.entries(totalAssets)
            .filter(([_, amount]) => amount > 0)
            .map(([currency, amount]) => `${CURRENCY_EMOJI[currency as Currency]} ${formatCurrencyFull(amount)}`)
            .join(' · ') || '-'}
          icon={Wallet}
        />
      </motion.div>

      <motion.div variants={gridItem}>
        <StatCard
          title="资金利用率"
          value={`${deploymentRate.toFixed(1)}%`}
          subtitle={`${(100 - deploymentRate).toFixed(1)}% 待投放`}
          icon={TrendingUp}
        />
      </motion.div>

      <motion.div variants={gridItem}>
        <StatCard
          title="即将到期 (30天)"
          value={formatCurrencyFull(incomingLiquidity)}
          subtitle={`${incomingCount} 个资金单元`}
          icon={Calendar}
          variant={incomingCount > 0 ? 'default' : 'default'}
        />
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// CURRENCY DISTRIBUTION CHART
// ============================================================================

// ============================================================================
// STATUS DISTRIBUTION CHART
// ============================================================================

// ============================================================================
// MATURITY DISTRIBUTION CHART
// ============================================================================

// ============================================================================
// STRATEGY ALLOCATION CHART
// ============================================================================


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
    <motion.div
      initial="initial"
      animate="animate"
      variants={fadeInUp}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
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
      <motion.div
        variants={gridContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* Strategy Distribution */}
        {dashboardData?.strategy_allocation && (
          <motion.div variants={gridItem}>
            <DistributionPieChart
              title="策略分布"
              data={dashboardData.strategy_allocation.map(item => ({
                name: item.strategy,
                value: item.total_amount,
                percentage: item.percentage,
                color: STRATEGY_COLORS[item.strategy]
              }))}
              selected={selectedStrategy}
              onClick={setSelectedStrategy}
              showAction={true}
            />
          </motion.div>
        )}

        {/* Currency Distribution */}
        <motion.div variants={gridItem}>
          <DistributionPieChart
            title="币种分布"
            data={currencyDistribution.map(item => ({
              name: `${CURRENCY_EMOJI[item.currency]} ${item.currency}`,
              value: item.amount,
              percentage: item.percentage,
              color: CURRENCY_COLORS[item.currency]
            }))}
          />
        </motion.div>

        {/* Status Distribution */}
        <motion.div variants={gridItem}>
          <DistributionPieChart
            title="状态分布"
            data={statusDistribution.map(item => ({
              name: item.status,
              value: item.amount,
              percentage: item.percentage,
              color: STATUS_COLORS[item.status]
            }))}
          />
        </motion.div>

        {/* Maturity Distribution */}
        <motion.div variants={gridItem}>
          <DistributionPieChart
            title="到期时间分布"
            data={maturityDistribution.map(item => ({
              name: item.period,
              value: item.amount,
              percentage: item.percentage,
              color: MATURITY_COLORS[item.period]
            }))}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
