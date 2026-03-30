/**
 * Strategy Sunburst Chart
 *
 * 层级视角: 币种 -> 策略 -> 产品
 * 解决集中度风险问题
 */

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { TooltipComponent } from 'echarts/components';
import { SunburstChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { useStrategySunburstViewModel } from '@/viewmodels/assets/useStrategySunburstViewModel';

echarts.use([TooltipComponent, SunburstChart, CanvasRenderer]);

export function StrategySunburst() {
  const { units, chartData, totalAmount } = useStrategySunburstViewModel();

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      formatter: (params: { value?: number; name?: string }) => {
        const value = params.value || 0;
        const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(2) : '0.00';
        const currencySymbol = {
          CNY: '¥',
          USD: '$',
          HKD: 'HK$',
        }['CNY']; // Default to CNY

        return `
          <div style="padding: 8px;">
            <div style="font-weight: 600; margin-bottom: 4px;">${params.name || ''}</div>
            <div style="font-size: 12px; color: #666;">
              金额: ${currencySymbol}${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/>
              占比: ${percentage}%
            </div>
          </div>
        `;
      },
    },
    series: [
      {
        type: 'sunburst',
        data: [chartData],
        radius: [0, '90%'],
        sort: undefined, // Keep original order

        emphasis: {
          focus: 'ancestor',
        },

        levels: [
          {}, // Level 0: root (hidden)
          {
            // Level 1: Currency
            r0: '0%',
            r: '30%',
            itemStyle: {
              borderWidth: 2,
              borderColor: '#fff',
            },
            label: {
              rotate: 'tangential',
              align: 'center',
              fontSize: 14,
              fontWeight: 600,
            },
          },
          {
            // Level 2: Strategy
            r0: '30%',
            r: '60%',
            itemStyle: {
              borderWidth: 2,
              borderColor: '#fff',
            },
            label: {
              rotate: 'tangential',
              align: 'center',
              fontSize: 12,
            },
          },
          {
            // Level 3: Product
            r0: '60%',
            r: '90%',
            label: {
              align: 'center',
              fontSize: 11,
              position: 'outside',
              padding: 3,
              silent: false,
            },
            itemStyle: {
              borderWidth: 1,
              borderColor: '#fff',
            },
          },
        ],
      },
    ],
  }), [chartData, totalAmount]);

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
        <h2 className="text-2xl font-bold">策略透视</h2>
        <p className="text-muted-foreground">
          从币种 → 策略 → 产品的层级视角,识别集中度风险
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
          <h3 className="font-semibold mb-2">💡 透视价值</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 识别单一渠道/产品过度集中</li>
            <li>• 评估美元资产配置占比</li>
            <li>• 检查各策略资金分布均衡性</li>
            <li>• 发现"产品名称不同但实际同类"的情况</li>
          </ul>
        </div>

        <div className="border rounded-lg p-4 bg-muted/30">
          <h3 className="font-semibold mb-2">📊 使用指南</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>内圈</strong>: 币种分类 (CNY/USD/HKD)</li>
            <li>• <strong>中圈</strong>: 投资策略 (养老/消费/激进)</li>
            <li>• <strong>外圈</strong>: 具体产品</li>
            <li>• <strong>面积</strong>: 代表资金量大小</li>
            <li>• 悬停查看详细金额和占比</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
