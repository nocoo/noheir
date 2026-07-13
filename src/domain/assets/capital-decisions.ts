import type { UnitDisplayInfo, Currency } from "../types";
import { formatCurrencyFull } from "@/lib/chart-config";

export type DecisionItem = {
  unit: UnitDisplayInfo;
  reason: string;
  urgency: "high" | "medium" | "low";
  details: string;
};

export type SortColumn = "番号" | "策略" | "紧急度" | "说明";
export type SortDirection = "asc" | "desc" | null;

export const classifyDecisions = (units: UnitDisplayInfo[]): DecisionItem[] => {
  const decisions: DecisionItem[] = [];

  units.forEach((unit) => {
    if (unit.status === "计划中") {
      decisions.push({
        unit,
        reason: "待成立",
        urgency: "low",
        details: `资金正在筹集中，目标金额 ${formatCurrencyFull(unit.amount)}`,
      });
      return;
    }

    if (unit.status !== "已成立") return;

    if (!unit.product) {
      decisions.push({
        unit,
        reason: "待投放",
        urgency: "high",
        details: "资金已到位但未配置任何产品",
      });
      return;
    }

    if (unit.product.category === "现金+") {
      decisions.push({
        unit,
        reason: "待再配置",
        urgency: "medium",
        details: `当前在"${unit.product.name}"，建议配置到固定收益产品`,
      });
      return;
    }

    if (unit.isAvailable) {
      const daysSinceAvailable =
        unit.daysUntilAvailable !== null ? -unit.daysUntilAvailable : undefined;
      if (daysSinceAvailable !== undefined && daysSinceAvailable <= 30) {
        decisions.push({
          unit,
          reason: "刚解锁",
          urgency: "medium",
          details: `"${unit.product.name}"刚解锁 ${daysSinceAvailable} 天，建议关注再配置机会`,
        });
      } else {
        decisions.push({
          unit,
          reason: "已可用",
          urgency: "low",
          details: `"${unit.product.name}"锁定期已过，资金可用且持续产生收益，可灵活再配置`,
        });
      }
      return;
    }

    if (unit.daysUntilAvailable !== null && unit.daysUntilAvailable <= 7) {
      const daysText =
        unit.daysUntilAvailable === 0
          ? "今日"
          : unit.daysUntilAvailable === 1
            ? "明日"
            : `${unit.daysUntilAvailable}天后`;
      decisions.push({
        unit,
        reason: "即将解锁",
        urgency: "high",
        details: `"${unit.product.name}"${daysText}解锁，金额 ${formatCurrencyFull(unit.amount)}，可规划再配置`,
      });
      return;
    }

    if (unit.daysUntilAvailable !== null && unit.daysUntilAvailable <= 30) {
      decisions.push({
        unit,
        reason: "即将解锁",
        urgency: "medium",
        details: `"${unit.product.name}" ${unit.daysUntilAvailable}天后解锁，可提前规划再配置`,
      });
    }
  });

  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  return decisions.sort((a, b) => {
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return a.unit.unitCode.localeCompare(b.unit.unitCode, "zh-CN");
  });
};

export const buildDecisionStats = (decisions: DecisionItem[]) => {
  const byUrgency = {
    high: decisions.filter((d) => d.urgency === "high"),
    medium: decisions.filter((d) => d.urgency === "medium"),
    low: decisions.filter((d) => d.urgency === "low"),
  };

  const totalAmount = decisions.reduce((sum, d) => sum + d.unit.amount, 0);

  return {
    total: decisions.length,
    totalAmount,
    high: byUrgency.high.length,
    medium: byUrgency.medium.length,
    low: byUrgency.low.length,
    highAmount: byUrgency.high.reduce((sum, d) => sum + d.unit.amount, 0),
    mediumAmount: byUrgency.medium.reduce((sum, d) => sum + d.unit.amount, 0),
    lowAmount: byUrgency.low.reduce((sum, d) => sum + d.unit.amount, 0),
  };
};

export const buildFilterCounts = (decisions: DecisionItem[]) => ({
  all: decisions.length,
  high: decisions.filter((d) => d.urgency === "high").length,
  medium: decisions.filter((d) => d.urgency === "medium").length,
  low: decisions.filter((d) => d.urgency === "low").length,
});

export const buildCurrencyTooltip = (currency: Currency, amount: number): string => {
  const symbol = { CNY: "¥", USD: "$", HKD: "HK$" }[currency];
  return `${symbol}${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const sortDecisions = (
  decisions: DecisionItem[],
  sortColumn: SortColumn | null,
  sortDirection: SortDirection,
): DecisionItem[] => {
  if (!sortColumn || !sortDirection) return decisions;

  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  return [...decisions].sort((a, b) => {
    let compareValue = 0;
    switch (sortColumn) {
      case "番号":
        compareValue = a.unit.unitCode.localeCompare(b.unit.unitCode, "zh-CN");
        break;
      case "策略":
        compareValue = a.unit.strategy.localeCompare(b.unit.strategy, "zh-CN");
        break;
      case "紧急度":
        compareValue = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        break;
      case "说明":
        compareValue = a.details.localeCompare(b.details, "zh-CN");
        break;
    }
    return sortDirection === "asc" ? compareValue : -compareValue;
  });
};
