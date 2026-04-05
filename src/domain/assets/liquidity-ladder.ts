import { addMonths, format, isBefore, startOfMonth } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { UnitDisplayInfo } from "../types";

export type MonthlyAvailability = {
  month: string;
  monthLabel: string;
  strategy: string;
  amount: number;
};

export const buildMonthlyAvailability = (
  units: UnitDisplayInfo[],
  monthsAhead = 24,
) => {
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
      if (
        !monthlyAvailability.find(
          (m) => m.month === month && m.strategy === strategy,
        )
      ) {
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
