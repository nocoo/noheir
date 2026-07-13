import { addMonths, format, isBefore, startOfMonth } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { UnitDisplayInfo } from "../types";

export type MonthlyAvailability = {
  month: string;
  monthLabel: string;
  strategy: string;
  amount: number;
};

export const buildMonthlyAvailability = (units: UnitDisplayInfo[], monthsAhead = 24) => {
  if (!units || units.length === 0) {
    return {
      monthlyAvailability: [] as MonthlyAvailability[],
      strategies: [] as string[],
      months: [] as string[],
    };
  }

  const establishedUnits = units.filter(
    (unit) => unit.status === "已成立" && unit.availableDate && unit.product,
  );
  const today = new Date();
  const months: string[] = [];
  const strategySet = new Set<string>();

  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = startOfMonth(addMonths(today, i));
    months.push(format(monthDate, "yyyy-MM"));
  }

  const monthlyMap = new Map<string, Map<string, number>>();

  establishedUnits.forEach((unit) => {
    if (!unit.availableDate || !unit.strategy) return;
    const availableDate = new Date(unit.availableDate);
    const monthKey = format(availableDate, "yyyy-MM");
    const strategy = unit.strategy;

    if (isBefore(startOfMonth(availableDate), startOfMonth(today))) return;

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, new Map());
    }
    const monthData = monthlyMap.get(monthKey);
    if (!monthData) return;
    monthData.set(strategy, (monthData.get(strategy) ?? 0) + unit.amount);
    strategySet.add(strategy);
  });

  const monthlyAvailability: MonthlyAvailability[] = [];
  monthlyMap.forEach((strategyMap, month) => {
    const monthDate = new Date(month + "-01");
    const monthLabel = format(monthDate, "yyyy年M月", { locale: zhCN });

    strategyMap.forEach((amount, strategy) => {
      monthlyAvailability.push({ month, monthLabel, strategy, amount });
    });
  });

  months.forEach((month) => {
    const monthDate = new Date(month + "-01");
    const monthLabel = format(monthDate, "yyyy年M月", { locale: zhCN });
    strategySet.forEach((strategy) => {
      if (!monthlyAvailability.find((m) => m.month === month && m.strategy === strategy)) {
        monthlyAvailability.push({ month, monthLabel, strategy, amount: 0 });
      }
    });
  });

  return {
    monthlyAvailability,
    strategies: Array.from(strategySet).sort(),
    months,
  };
};

export const buildSeries = (monthlyData: {
  monthlyAvailability: MonthlyAvailability[];
  strategies: string[];
  months: string[];
}) => {
  return monthlyData.strategies.map((strategy) => ({
    name: strategy,
    type: "bar" as const,
    stack: "total",
    data: monthlyData.months.map((month) => {
      const item = monthlyData.monthlyAvailability.find(
        (m) => m.month === month && m.strategy === strategy,
      );
      return item?.amount ?? 0;
    }),
  }));
};

export const buildSummaryStats = (monthlyData: {
  monthlyAvailability: MonthlyAvailability[];
  months: string[];
}) => {
  const next12Months = monthlyData.months.slice(0, 12);
  const total = next12Months.reduce((sum, month) => {
    const monthTotal = monthlyData.monthlyAvailability
      .filter((m) => m.month === month)
      .reduce((s, m) => s + m.amount, 0);
    return sum + monthTotal;
  }, 0);

  const peakMonth = next12Months.reduce(
    (max, month) => {
      const monthTotal = monthlyData.monthlyAvailability
        .filter((m) => m.month === month)
        .reduce((s, m) => s + m.amount, 0);
      return monthTotal > max.amount ? { month, amount: monthTotal } : max;
    },
    { month: "", amount: 0 },
  );

  return {
    total,
    avgMonth: total / 12,
    peakMonth,
  };
};

export type UpcomingUnit = {
  id: string;
  unitCode: string;
  amount: number;
  currency: string;
  strategy: string;
  tactics: string;
  productName: string | null;
  productChannel: string | null;
  availableDate: string;
  monthKey: string;
  monthLabel: string;
  daysUntilAvailable: number;
};

/**
 * Build list of units becoming available in the next N months
 */
export const buildUpcomingUnits = (units: UnitDisplayInfo[], monthsAhead = 24): UpcomingUnit[] => {
  const today = new Date();
  const cutoffDate = addMonths(today, monthsAhead);

  return units
    .filter((unit) => {
      if (unit.status !== "已成立") return false;
      if (!unit.availableDate) return false;
      const availDate = new Date(unit.availableDate);
      // Include units available from today onwards, up to cutoff
      return availDate >= today && availDate <= cutoffDate;
    })
    .map((unit) => {
      // Safe to assert: filter above ensures availableDate exists
      const availableDateStr = unit.availableDate as string;
      const availDate = new Date(availableDateStr);
      const monthKey = format(availDate, "yyyy-MM");
      const monthLabel = format(availDate, "yyyy年M月", { locale: zhCN });
      const diffTime = availDate.getTime() - today.getTime();
      const daysUntilAvailable = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: unit.id,
        unitCode: unit.unitCode,
        amount: unit.amount,
        currency: unit.currency,
        strategy: unit.strategy,
        tactics: unit.tactics,
        productName: unit.product?.name ?? null,
        productChannel: unit.product?.channel ?? null,
        availableDate: availableDateStr,
        monthKey,
        monthLabel,
        daysUntilAvailable,
      };
    })
    .sort((a, b) => a.availableDate.localeCompare(b.availableDate));
};
