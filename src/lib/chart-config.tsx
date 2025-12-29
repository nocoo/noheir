/**
 * 统一的图表样式配置工厂方法
 * 用于保持整个项目中所有图表的视觉一致性
 */

// Tooltip 统一样式
export const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    color: 'hsl(var(--foreground))'
  }
};

// XAxis 统一样式
export const xAxisStyle = {
  tick: { fill: 'hsl(var(--foreground))', fontSize: 12 },
  axisLine: { stroke: 'hsl(var(--border))' }
};

// YAxis 统一样式
export const yAxisStyle = {
  tick: { fill: 'hsl(var(--foreground))', fontSize: 12 },
  axisLine: { stroke: 'hsl(var(--border))' }
};

// CartesianGrid 统一样式
export const gridStyle = {
  strokeDasharray: '3 3',
  stroke: 'hsl(var(--border))'
};

// Legend 统一样式
export const legendStyle = {
  formatter: (value: string) => (
    <span style={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}>
      {value}
    </span>
  )
};

/**
 * 金额格式化器 - 标准格式
 */
export const formatCurrency = (value: number): string => {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * 金额格式化器 - 简化格式（k为单位）
 */
export const formatCurrencyK = (value: number): string => {
  return `¥${(value / 1000).toFixed(0)}k`;
};

/**
 * 金额格式化器 - 带一位小数的k格式
 */
export const formatCurrencyK1 = (value: number): string => {
  return `¥${(value / 1000).toFixed(1)}k`;
};

/**
 * Tooltip formatter - 金额格式
 */
export const tooltipCurrencyFormatter = (value: number): [string, string] => {
  return [formatCurrency(value), '金额'];
};

/**
 * Tooltip formatter - 自定义标签
 */
export const createTooltipFormatter = (label: string) => (value: number): [string, string] => {
  return [formatCurrency(value), label];
};

/**
 * 获取统一的chart margin配置
 */
export const getChartMargin = (size: 'small' | 'medium' | 'large' = 'medium') => {
  const margins = {
    small: { top: 10, right: 20, bottom: 10, left: 10 },
    medium: { top: 20, right: 30, bottom: 20, left: 20 },
    large: { top: 30, right: 40, bottom: 30, left: 40 }
  };
  return margins[size];
};

/**
 * 获取统一的YAxis宽度配置
 */
export const yAxisWidth = 100;

/**
 * 创建金额格式的YAxis tick formatter
 */
export const createYAxisCurrencyFormatter = (unit: 'standard' | 'k' | 'k1' = 'k') => {
  const formatters = {
    standard: (v: number) => formatCurrency(v),
    k: (v: number) => formatCurrencyK(v),
    k1: (v: number) => formatCurrencyK1(v)
  };
  return formatters[unit];
};
