import type { Currency, InvestmentStrategy, UnitDisplayInfo } from "../types";

type DashboardDataLike = {
  total_assets: number;
  invested_amount: number;
  upcoming_maturities: Array<{ amount: number }>;
};

export const buildTotalAssetsByCurrency = (
  units: UnitDisplayInfo[],
): Record<Currency, number> => {
  const totals: Record<Currency, number> = { CNY: 0, USD: 0, HKD: 0 };
  units.forEach((unit) => {
    if (unit.status === "已成立") {
      totals[unit.currency] = (totals[unit.currency] ?? 0) + unit.amount;
    }
  });
  return totals;
};

export const buildTotalAssetsAll = (
  totals: Record<Currency, number>,
): number => {
  return Object.values(totals).reduce((sum, amount) => sum + amount, 0);
};

export const buildDeploymentRate = (
  dashboardData?: DashboardDataLike,
): number => {
  if (!dashboardData || dashboardData.total_assets === 0) return 0;
  return (dashboardData.invested_amount / dashboardData.total_assets) * 100;
};

export const buildIdleUnits = (
  units: UnitDisplayInfo[],
): UnitDisplayInfo[] => {
  return units.filter((unit) => unit.status === "已成立" && !unit.product);
};

export const buildIncomingLiquidity = (
  dashboardData?: DashboardDataLike,
): { total: number; count: number } => {
  const total =
    dashboardData?.upcoming_maturities.reduce(
      (sum, m) => sum + m.amount,
      0,
    ) ?? 0;
  const count = dashboardData?.upcoming_maturities.length ?? 0;
  return { total, count };
};

export const buildCurrencyDistribution = (
  units: UnitDisplayInfo[],
  totalAssetsAll: number,
) => {
  const currencyMap: Record<string, number> = {};
  units.forEach((unit) => {
    if (unit.status === "已成立") {
      currencyMap[unit.currency] =
        (currencyMap[unit.currency] ?? 0) + unit.amount;
    }
  });

  return Object.entries(currencyMap).map(([currency, amount]) => ({
    currency: currency as Currency,
    amount,
    percentage: totalAssetsAll > 0 ? (amount / totalAssetsAll) * 100 : 0,
  }));
};

export const buildStatusDistribution = (
  units: UnitDisplayInfo[],
  totalAssetsAll: number,
) => {
  const statusMap: Record<string, number> = {};
  units.forEach((unit) => {
    if (unit.status === "已成立") {
      statusMap[unit.status] = (statusMap[unit.status] ?? 0) + unit.amount;
    }
  });

  return Object.entries(statusMap).map(([status, amount]) => ({
    status,
    amount,
    percentage: totalAssetsAll > 0 ? (amount / totalAssetsAll) * 100 : 0,
  }));
};

export const buildMaturityDistribution = (
  units: UnitDisplayInfo[],
  totalAssetsAll: number,
) => {
  let expired = 0;
  let within7d = 0;
  let within30d = 0;
  let within90d = 0;
  let beyond90d = 0;

  units.forEach((unit) => {
    if (!unit.endDate || unit.status !== "已成立") return;
    if (unit.isAvailable) {
      expired += unit.amount;
      return;
    }

    if (unit.daysUntilMaturity !== undefined) {
      if (unit.daysUntilMaturity <= 7) {
        within7d += unit.amount;
      } else if (unit.daysUntilMaturity <= 30) {
        within30d += unit.amount;
      } else if (unit.daysUntilMaturity <= 90) {
        within90d += unit.amount;
      } else {
        beyond90d += unit.amount;
      }
    }
  });

  const buckets: Array<[string, number]> = [
    ["已到期", expired],
    ["7天内", within7d],
    ["30天内", within30d],
    ["90天内", within90d],
    ["90天以上", beyond90d],
  ];

  return buckets
    .filter(([, amount]) => amount > 0)
    .map(([period, amount]) => ({
      period,
      amount,
      percentage: totalAssetsAll > 0 ? (amount / totalAssetsAll) * 100 : 0,
    }));
};

export const buildStrategyChartData = (
  strategyAllocation: Array<{
    strategy: InvestmentStrategy;
    total_amount: number;
    percentage: number;
  }>,
) => {
  return strategyAllocation.map((item) => ({
    name: item.strategy,
    value: item.total_amount,
    percentage: item.percentage,
  }));
};
