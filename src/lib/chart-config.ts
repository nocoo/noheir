/**
 * Chart configuration utilities.
 *
 * Pure formatting functions extracted from Gen 1's chart-config.tsx.
 * No JSX — this file is server-safe.
 */

export const formatCurrency = (value: number): string => {
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatCurrencyFull = (value: number): string => {
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatCurrencyK = (value: number): string => {
  return `¥${(value / 1000).toFixed(2)}k`;
};

export const formatDate = (date: string): string => {
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN");
};

export const getChartMargin = (
  size: "small" | "medium" | "large" = "medium",
) => {
  const margins = {
    small: { top: 10, right: 20, bottom: 10, left: 10 },
    medium: { top: 20, right: 30, bottom: 20, left: 20 },
    large: { top: 30, right: 40, bottom: 30, left: 40 },
  };
  return margins[size];
};

export const yAxisWidth = 100;

export const createYAxisCurrencyFormatter = (
  unit: "standard" | "k" = "k",
) => {
  return unit === "standard" ? formatCurrency : formatCurrencyK;
};
