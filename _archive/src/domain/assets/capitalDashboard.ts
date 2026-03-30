import type { Currency, InvestmentStrategy, UnitStatus } from '@/types/assets';

type UnitLike = {
  status: UnitStatus;
  currency: Currency;
  amount: number;
  product?: unknown;
  end_date?: string | null;
  is_available?: boolean;
  days_until_maturity?: number;
};

type DashboardDataLike = {
  total_assets: number;
  invested_amount: number;
  upcoming_maturities: Array<{ amount: number }>;
};

export const buildTotalAssetsByCurrency = (units: UnitLike[]) => {
  const totals: Record<Currency, number> = { CNY: 0, USD: 0, HKD: 0 };
  units.forEach(unit => {
    if (unit.status === '已成立') {
      totals[unit.currency] = (totals[unit.currency] || 0) + unit.amount;
    }
  });
  return totals;
};

export const buildTotalAssetsAll = (totals: Record<Currency, number>) => {
  return Object.values(totals).reduce((sum, amount) => sum + amount, 0);
};

export const buildDeploymentRate = (dashboardData?: DashboardDataLike) => {
  if (!dashboardData || dashboardData.total_assets === 0) return 0;
  return (dashboardData.invested_amount / dashboardData.total_assets) * 100;
};

export const buildIdleUnits = (units: UnitLike[]) => {
  return units.filter(unit => unit.status === '已成立' && !unit.product);
};

export const buildIncomingLiquidity = (dashboardData?: DashboardDataLike) => {
  const total = dashboardData?.upcoming_maturities.reduce((sum, m) => sum + m.amount, 0) || 0;
  const count = dashboardData?.upcoming_maturities.length || 0;
  return { total, count };
};

export const buildCurrencyDistribution = (units: UnitLike[], totalAssetsAll: number) => {
  const currencyMap: Record<string, number> = {};
  units.forEach(unit => {
    if (unit.status === '已成立') {
      currencyMap[unit.currency] = (currencyMap[unit.currency] || 0) + unit.amount;
    }
  });

  return Object.entries(currencyMap).map(([currency, amount]) => ({
    currency: currency as Currency,
    amount,
    percentage: totalAssetsAll > 0 ? (amount / totalAssetsAll) * 100 : 0,
  }));
};

export const buildStatusDistribution = (units: UnitLike[], totalAssetsAll: number) => {
  const statusMap: Record<string, number> = {};
  units.forEach(unit => {
    if (unit.status === '已成立') {
      statusMap[unit.status] = (statusMap[unit.status] || 0) + unit.amount;
    }
  });

  return Object.entries(statusMap).map(([status, amount]) => ({
    status: status as UnitStatus,
    amount,
    percentage: totalAssetsAll > 0 ? (amount / totalAssetsAll) * 100 : 0,
  }));
};

export const buildMaturityDistribution = (units: UnitLike[], totalAssetsAll: number) => {
  const buckets: Record<string, number> = {
    '已到期': 0,
    '7天内': 0,
    '30天内': 0,
    '90天内': 0,
    '90天以上': 0,
  };

  units.forEach(unit => {
    if (!unit.end_date || unit.status !== '已成立') return;
    if (unit.is_available) {
      buckets['已到期'] += unit.amount;
      return;
    }

    if (unit.days_until_maturity !== undefined) {
      if (unit.days_until_maturity <= 7) {
        buckets['7天内'] += unit.amount;
      } else if (unit.days_until_maturity <= 30) {
        buckets['30天内'] += unit.amount;
      } else if (unit.days_until_maturity <= 90) {
        buckets['90天内'] += unit.amount;
      } else {
        buckets['90天以上'] += unit.amount;
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
};

export const buildStrategyChartData = (strategyAllocation: Array<{ strategy: InvestmentStrategy; total_amount: number; percentage: number }>) => {
  return strategyAllocation.map(item => ({
    name: item.strategy,
    value: item.total_amount,
    percentage: item.percentage,
  }));
};
