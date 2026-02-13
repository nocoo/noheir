/**
 * Capital Dashboard Component
 *
 * "Capital Command Center" - Visual overview of capital units and their relation to products
 */

import { useCapitalDashboardViewModel } from '@/viewmodels/assets/useCapitalDashboardViewModel';
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
import type { InvestmentStrategy, Currency } from '@/types/assets';
import { DistributionPieChart } from './DistributionPieChart';
import {
  strategyColor,
  currencyColor,
  statusColor,
  maturityColor,
} from '@/lib/palette';
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
  const {
    dashboardData,
    dashboardLoading,
    unitsLoading,
    selectedStrategy,
    handleStrategySelect,
    totalAssetsByCurrency,
    totalAssetsAll,
    deploymentRate,
    idleCount,
    idleAmount,
    incomingLiquidity,
    incomingCount,
    currencyDistribution,
    statusDistribution,
    maturityDistribution,
    strategyChartData,
  } = useCapitalDashboardViewModel();

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
          {strategyChartData.length > 0 && (
            <motion.div variants={gridItem}>
              <DistributionPieChart
                title="策略分布"
                data={strategyChartData.map(item => ({
                  name: item.name,
                  value: item.value,
                  percentage: item.percentage,
                  color: strategyColor(item.name)
                }))}
                selected={selectedStrategy}
                onClick={handleStrategySelect}
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
              color: currencyColor(item.currency)
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
              color: statusColor(item.status)
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
              color: maturityColor(item.period)
            }))}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
