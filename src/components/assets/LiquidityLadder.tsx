/**
 * Liquidity Ladder Chart
 *
 * 展示未来24个月资金到期分布
 * 配合梯队策略(Laddering)设计
 */

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { TooltipComponent, GridComponent, MarkLineComponent } from 'echarts/components';
import { BarChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { formatCurrencyFull } from '@/lib/chart-config';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useLiquidityLadderViewModel } from '@/viewmodels/assets/useLiquidityLadderViewModel';

echarts.use([TooltipComponent, GridComponent, MarkLineComponent, BarChart, CanvasRenderer]);

interface MonthlyMaturity {
  month: string;        // YYYY-MM
  monthLabel: string;   // 2024年1月
  strategy: string;
  amount: number;
}

interface TooltipAxisParam {
  axisValue?: string | number;
  value?: string | number;
  seriesName?: string;
  color?: string;
}

export function LiquidityLadder() {
  const { units, monthlyData, series, summary, currencySymbol } = useLiquidityLadderViewModel();

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: (params: TooltipAxisParam[]) => {
        if (!Array.isArray(params) || params.length === 0) return '';

        const month = String(params[0].axisValue);
        const monthDate = new Date(month + '-01');
        const monthLabel = format(monthDate, 'yyyy年M月', { locale: zhCN });

        let total = 0;
        const items = params.map((param) => {
          const value = Number(param.value || 0);
          if (value > 0) {
            total += value;
            return `
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; background: ${param.color}; border-radius: 2px;"></span>
                <span style="flex: 1;">${param.seriesName}</span>
                <span style="font-weight: 600;">${currencySymbol}${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            `;
          }
          return '';
        }).filter(Boolean);

        if (items.length === 0) return '';

        return `
          <div style="padding: 8px; min-width: 200px;">
            <div style="font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
              ${monthLabel}
            </div>
            ${items.join('')}
            <div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid #e5e7eb; font-weight: 600;">
              合计: ${currencySymbol}${total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        `;
      },
    },
    legend: {
      data: monthlyData.strategies,
      top: 20,
      type: 'scroll',
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: monthlyData.months.map(month => {
        const monthDate = new Date(month + '-01');
        return format(monthDate, 'yyyy年M月', { locale: zhCN });
      }),
      axisLabel: {
        rotate: 45,
        fontSize: 11,
        interval: 0,
      },
      axisLine: {
        lineStyle: {
          color: '#d1d5db',
        },
      },
    },
    yAxis: {
      type: 'value',
      name: '解锁金额',
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 10000) {
            return `${(value / 10000).toFixed(0)}万`;
          }
          return value.toFixed(0);
        },
      },
      axisLine: {
        lineStyle: {
          color: '#d1d5db',
        },
      },
      splitLine: {
        lineStyle: {
          color: '#e5e7eb',
          type: 'dashed',
        },
      },
    },
    series: series.map(s => ({
      ...s,
      emphasis: {
        focus: 'series',
      },
    })),
  }), [monthlyData, series, currencySymbol]);

  if (!units || units.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">暂无数据</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">流动性梯队</h2>
        <p className="text-muted-foreground">
          展示未来24个月资金到期分布,配合梯队策略做好再投资规划
        </p>
      </div>

      {/* Chart */}
      <div className="border rounded-xl p-6 bg-card">
        <ReactECharts
          option={option}
          style={{ height: 'calc(100vh - 300px)', minHeight: '600px' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {/* Insights */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-muted/30">
          <h3 className="font-semibold mb-2">💡 使用场景</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 查看每月资金到账情况,规划大额支出</li>
            <li>• 识别到期高峰,提前准备再投资方案</li>
            <li>• 配合"阶梯策略",平滑资金到期时间</li>
            <li>• 评估流动性风险,避免资金过度集中到期</li>
          </ul>
        </div>

        <div className="border rounded-lg p-4 bg-muted/30">
          <h3 className="font-semibold mb-2">📊 阅读指南</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>X轴</strong>: 未来24个月,按月显示</li>
            <li>• <strong>Y轴</strong>: 当月解锁金额</li>
            <li>• <strong>堆叠颜色</strong>: 按投资策略分类</li>
            <li>• <strong>悬停</strong>: 查看当月详细金额和合计</li>
            <li>• <strong>柱高</strong>: 代表当月到期资金总量</li>
          </ul>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <h3 className="font-semibold mb-3">📈 未来12个月到期统计</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold">{currencySymbol}{(summary.total / 10000).toFixed(1)}万</div>
            <div className="text-xs text-muted-foreground">12个月到期总额</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{currencySymbol}{(summary.avgMonth / 10000).toFixed(1)}万</div>
            <div className="text-xs text-muted-foreground">月均到期</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {(() => {
                const monthDate = new Date(summary.peakMonth.month + '-01');
                return format(monthDate, 'M月', { locale: zhCN });
              })()}
            </div>
            <div className="text-xs text-muted-foreground">到期高峰月</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{currencySymbol}{(summary.peakMonth.amount / 10000).toFixed(1)}万</div>
            <div className="text-xs text-muted-foreground">高峰金额</div>
          </div>
        </div>
      </div>
    </div>
  );
}
