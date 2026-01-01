/**
 * Unified Tooltip System
 *
 * 统一的图表 Tooltip 系统，提供标准化的 tooltip 样式和格式化
 * Unified tooltip system with standardized styles and formatters
 */

import { formatCurrencyFull } from './chart-config';
import React from 'react';

// ============================================================================
// RECHARTS TOOLTIP STYLES
// ============================================================================

/**
 * Standard tooltip content style for Recharts
 */
export const tooltipContentStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  fontSize: '13px',
  color: 'hsl(var(--foreground))',
  padding: '8px 12px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
};

/**
 * Standard tooltip item style for Recharts
 */
export const tooltipItemStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  fontSize: '13px',
  color: 'hsl(var(--foreground))',
};

/**
 * Label style for tooltip
 */
export const tooltipLabelStyle = {
  fontWeight: '600',
  marginBottom: '4px',
  fontSize: '13px',
  color: 'hsl(var(--foreground))',
};

// ============================================================================
// RECHARTS TOOLTIP COMPONENTS
// ============================================================================

/**
 * Standard tooltip for currency values with percentage
 */
interface CurrencyPercentageTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

export function CurrencyPercentageTooltip({
  active,
  payload,
  label,
}: CurrencyPercentageTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div style={tooltipContentStyle}>
      {label && <p style={tooltipLabelStyle}>{label}</p>}
      {data.name && <p style={tooltipLabelStyle}>{data.name}</p>}
      <div style={tooltipItemStyle}>
        <span>金额</span>
        <span>{formatCurrencyFull(data.value)}</span>
      </div>
      {data.percentage !== undefined && (
        <div style={tooltipItemStyle}>
          <span>占比</span>
          <span>{data.percentage.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * Standard tooltip for currency values without percentage
 */
interface CurrencyTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueKey?: string;
  labelKey?: string;
}

export function CurrencyTooltip({
  active,
  payload,
  label,
  valueKey = 'value',
  labelKey = 'name',
}: CurrencyTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div style={tooltipContentStyle}>
      {(label || data[labelKey]) && (
        <p style={tooltipLabelStyle}>{label || data[labelKey]}</p>
      )}
      <div style={tooltipItemStyle}>
        <span>金额</span>
        <span>{formatCurrencyFull(data[valueKey])}</span>
      </div>
    </div>
  );
}

/**
 * Standard tooltip for pie/donut charts
 */
interface PieTooltipProps {
  active?: boolean;
  payload?: any[];
}

export function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;

  return (
    <div style={tooltipContentStyle}>
      <p style={tooltipLabelStyle}>{data.name}</p>
      <div style={tooltipItemStyle}>
        <span>金额</span>
        <span>{formatCurrencyFull(data.value)}</span>
      </div>
      {data.percentage !== undefined && (
        <div style={tooltipItemStyle}>
          <span>占比</span>
          <span>{data.percentage.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * Multi-series tooltip for line/area/bar charts
 */
interface MultiSeriesTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  seriesLabels?: string[];
}

export function MultiSeriesTooltip({
  active,
  payload,
  label,
  seriesLabels,
}: MultiSeriesTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div style={tooltipContentStyle}>
      {label && <p style={tooltipLabelStyle}>{label}</p>}
      {payload.map((entry: any, index: number) => (
        <div key={index} style={tooltipItemStyle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: entry.color,
              }}
            />
            {seriesLabels?.[index] || entry.name || entry.dataKey}
          </span>
          <span style={{ fontWeight: '500' }}>
            {formatCurrencyFull(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ECHARTS TOOLTIP CONFIGURATIONS
// ============================================================================

/**
 * Standard ECharts tooltip configuration for currency values
 */
export function createEChartsCurrencyTooltip(extraConfig: Record<string, any> = {}) {
  return {
    trigger: 'item' as const,
    formatter: (params: any) => {
      const value = params.value || params.data?.value || 0;
      const name = params.name || params.data?.name || '';
      const percentage = params.percent !== undefined ? ` (${params.percent.toFixed(1)}%)` : '';

      return `
        <div style="padding: 8px 12px;">
          <div style="font-weight: 600; margin-bottom: 4px; font-size: 13px;">${name}</div>
          <div style="font-size: 13px;">
            金额: ${formatCurrencyFull(value)}${percentage}
          </div>
        </div>
      `;
    },
    backgroundColor: 'hsl(var(--card))',
    borderColor: 'hsl(var(--border))',
    borderWidth: 1,
    textStyle: {
      fontSize: 13,
      color: 'hsl(var(--foreground))',
    },
    extraPadding: [8, 12],
    ...extraConfig,
  };
}

/**
 * ECharts tooltip for axis-based charts (line, bar, area)
 */
export function createEChartsAxisTooltip(extraConfig: Record<string, any> = {}) {
  return {
    trigger: 'axis' as const,
    formatter: (params: any[]) => {
      if (!params || params.length === 0) return '';

      const axisValue = params[0].axisValue || params[0].name;
      let result = `<div style="padding: 8px 12px;"><div style="font-weight: 600; margin-bottom: 6px; font-size: 13px;">${axisValue}</div>`;

      params.forEach((param: any) => {
        const marker = param.marker
          ? `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:8px;height:8px;background-color:${param.color};"></span>`
          : '';
        result += `
          <div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;font-size:13px;">
            <span>${marker}${param.seriesName}</span>
            <span style="font-weight:500;">${formatCurrencyFull(param.value)}</span>
          </div>
        `;
      });

      result += '</div>';
      return result;
    },
    backgroundColor: 'hsl(var(--card))',
    borderColor: 'hsl(var(--border))',
    borderWidth: 1,
    textStyle: {
      fontSize: 13,
      color: 'hsl(var(--foreground))',
    },
    extraPadding: [8, 12],
    ...extraConfig,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a custom tooltip formatter for Recharts
 */
export function createTooltipFormatter(
  label: string,
  formatter?: (value: number) => string
) {
  return (value: number): [string, string] => {
    return [
      formatter ? formatter(value) : formatCurrencyFull(value),
      label,
    ];
  };
}

/**
 * Create a percentage formatter for tooltips
 */
export function createPercentageFormatter() {
  return (value: number): string => {
    return `${value.toFixed(1)}%`;
  };
}
