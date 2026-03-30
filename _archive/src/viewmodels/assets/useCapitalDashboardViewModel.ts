import { useMemo, useState } from 'react';
import { useAssetDashboard, useUnitsDisplay } from '@/hooks/useAssets';
import type { InvestmentStrategy, Currency, UnitStatus } from '@/types/assets';
import {
  buildCurrencyDistribution,
  buildDeploymentRate,
  buildIncomingLiquidity,
  buildIdleUnits,
  buildMaturityDistribution,
  buildStatusDistribution,
  buildStrategyChartData,
  buildTotalAssetsAll,
  buildTotalAssetsByCurrency,
} from '@/domain/assets/capitalDashboard';

export function useCapitalDashboardViewModel() {
  const { data: dashboardData, isLoading: dashboardLoading } = useAssetDashboard();
  const { data: units, isLoading: unitsLoading } = useUnitsDisplay();
  const [selectedStrategy, setSelectedStrategy] = useState<InvestmentStrategy | null>(null);
  const handleStrategySelect = (name: string) => {
    setSelectedStrategy(name as InvestmentStrategy);
  };

  const totalAssetsByCurrency = useMemo(
    () => buildTotalAssetsByCurrency(units || []),
    [units]
  );

  const totalAssetsAll = useMemo(
    () => buildTotalAssetsAll(totalAssetsByCurrency),
    [totalAssetsByCurrency]
  );

  const deploymentRate = useMemo(
    () => buildDeploymentRate(dashboardData),
    [dashboardData]
  );

  const idleUnits = useMemo(
    () => buildIdleUnits(units || []),
    [units]
  );

  const idleCount = idleUnits.length;
  const idleAmount = idleUnits.reduce((sum, u) => sum + u.amount, 0);

  const { total: incomingLiquidity, count: incomingCount } = useMemo(
    () => buildIncomingLiquidity(dashboardData),
    [dashboardData]
  );

  const currencyDistribution = useMemo(
    () => buildCurrencyDistribution(units || [], totalAssetsAll),
    [units, totalAssetsAll]
  );

  const statusDistribution = useMemo(
    () => buildStatusDistribution(units || [], totalAssetsAll),
    [units, totalAssetsAll]
  );

  const maturityDistribution = useMemo(
    () => buildMaturityDistribution(units || [], totalAssetsAll),
    [units, totalAssetsAll]
  );

  const strategyChartData = useMemo(() => {
    if (!dashboardData?.strategy_allocation) return [];
    return buildStrategyChartData(dashboardData.strategy_allocation);
  }, [dashboardData]);

  return {
    dashboardData,
    units,
    dashboardLoading,
    unitsLoading,
    selectedStrategy,
    setSelectedStrategy,
    handleStrategySelect,
    totalAssetsByCurrency: totalAssetsByCurrency as Record<Currency, number>,
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
  };
}
