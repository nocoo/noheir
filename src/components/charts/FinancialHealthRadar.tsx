import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { FinancialHealthResult } from '@/lib/financial-health-algorithm';

interface FinancialHealthRadarProps {
  data: FinancialHealthResult;
}

export function FinancialHealthRadar({ data }: FinancialHealthRadarProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const dimensions = [
      {
        name: '成长性',
        max: 20,
        value: data.dimensions.growth.score,
        details: data.dimensions.growth.details.interpretation,
      },
      {
        name: '刚性',
        max: 25,
        value: data.dimensions.rigidity.score,
        details: data.dimensions.rigidity.details.interpretation,
      },
      {
        name: '质量',
        max: 15,
        value: data.dimensions.quality.score,
        details: data.dimensions.quality.details.interpretation,
      },
      {
        name: '韧性',
        max: 20,
        value: data.dimensions.resilience.score,
        details: data.dimensions.resilience.details.interpretation,
      },
      {
        name: '储蓄力',
        max: 20,
        value: data.dimensions.savings.score,
        details: data.dimensions.savings.details.interpretation,
      },
    ];

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const dim = dimensions[params.dataIndex];
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${dim.name}</div>
              <div>得分: ${dim.value} / ${dim.max}</div>
              <div style="color: #888; font-size: 12px; margin-top: 4px;">${dim.details}</div>
            </div>
          `;
        },
      },
      radar: {
        indicator: dimensions.map(d => ({
          name: d.name,
          max: d.max,
        })),
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: '#334155', // text-main color
          fontSize: 13,
          fontWeight: 500,
        },
        splitLine: {
          lineStyle: {
            color: '#e2e8f0', // border color
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: ['#f8fafc', '#ffffff'], // muted and card colors
          },
        },
        axisLine: {
          lineStyle: {
            color: '#e2e8f0', // border color
          },
        },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: dimensions.map(d => d.value),
              name: '财务健康',
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(99, 102, 241, 0.6)' },   // primary with 60% opacity
                    { offset: 1, color: 'rgba(99, 102, 241, 0.2)' },   // primary with 20% opacity
                  ],
                },
              },
              lineStyle: {
                color: 'rgb(99, 102, 241)', // primary color
                width: 2,
              },
              itemStyle: {
                color: 'rgb(99, 102, 241)', // primary color
              },
            },
          ],
        },
      ],
    };

    chartInstance.current.setOption(option);

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return (
    <div
      ref={chartRef}
      className="w-full h-[700px]"
    />
  );
}
