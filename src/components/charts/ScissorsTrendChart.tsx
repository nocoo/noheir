import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { FinancialHealthResult } from '@/lib/financial-health-algorithm';
import { MonthlyData } from '@/types/transaction';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';

interface ScissorsTrendChartProps {
  monthlyData: MonthlyData[];
  regression: FinancialHealthResult['monthlyRegression'];
}

export function ScissorsTrendChart({ monthlyData, regression }: ScissorsTrendChartProps) {
  const { settings } = useSettings();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const incomeColor = getIncomeColorHex(settings.colorScheme);
  const expenseColor = getExpenseColorHex(settings.colorScheme);

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  useEffect(() => {
    if (!chartRef.current || monthlyData.length === 0) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const xAxisData = monthlyData.map(d => d.month);
    const incomeData = monthlyData.map(d => d.income);
    const expenseData = monthlyData.map(d => d.expense);

    // Calculate regression lines
    const incomeRegression = monthlyData.map((_, i) =>
      regression.incomeTrend.intercept + regression.incomeTrend.slope * i
    );
    const expenseRegression = monthlyData.map((_, i) =>
      regression.expenseTrend.intercept + regression.expenseTrend.slope * i
    );

    // Generate scissors difference area data
    // Create a closed polygon: forward along upper line, backward along lower line
    const scissorsAreaData: (number | null)[][] = [];
    const forwardData: number[] = [];
    const backwardData: number[] = [];

    for (let i = 0; i < monthlyData.length; i++) {
      const upper = Math.max(incomeRegression[i], expenseRegression[i]);
      const lower = Math.min(incomeRegression[i], expenseRegression[i]);
      forwardData.push(upper);
      backwardData.unshift(lower);
    }

    // Combine: forward path + backward path to close the polygon
    scissorsAreaData.push(...forwardData.map((v, i) => [i, v]));
    scissorsAreaData.push([null, null]); // separator
    scissorsAreaData.push(...backwardData.map((v, i) => [monthlyData.length - 1 - i, v]));

    // Determine dominant color based on average trend difference
    const avgDiff = (incomeRegression[incomeRegression.length - 1] - expenseRegression[expenseRegression.length - 1]) -
                    (incomeRegression[0] - expenseRegression[0]);
    const scissorsColor = avgDiff > 0
      ? hexToRgba(incomeColor, 0.12)
      : hexToRgba(expenseColor, 0.12);

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params: any) => {
          let result = `<div style="padding: 4px;"><strong>${params[0].axisValue}</strong><br/>`;
          params.forEach((param: any) => {
            result += `${param.marker} ${param.seriesName}: ¥${param.value.toLocaleString()}<br/>`;
          });
          result += '</div>';
          return result;
        },
      },
      legend: {
        data: ['收入', '收入趋势', '支出', '支出趋势', '剪刀差'],
        bottom: 0,
        textStyle: {
          color: '#334155', // text-main color
        },
        selected: {
          '剪刀差': true,
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLine: { lineStyle: { color: '#e2e8f0' } }, // border color
        axisLabel: { color: '#64748b' }, // text-muted color
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#e2e8f0' } }, // border color
        axisLabel: {
          color: '#64748b', // text-muted color
          formatter: (value: number) => `¥${(value / 1000).toFixed(0)}k`,
        },
        splitLine: { lineStyle: { color: '#e2e8f0', opacity: 0.3 } }, // border color
      },
      series: [
        {
          name: '收入',
          type: 'line',
          data: incomeData,
          smooth: true,
          lineStyle: {
            color: incomeColor,
            width: 2,
          },
          itemStyle: {
            color: incomeColor,
          },
          showSymbol: false,
        },
        {
          name: '剪刀差',
          type: 'line',
          data: scissorsAreaData,
          showSymbol: false,
          lineStyle: { opacity: 0 },
          areaStyle: {
            color: scissorsColor,
          },
          silent: true,
          z: 0, // Behind other lines
        },
        {
          name: '收入趋势',
          type: 'line',
          data: incomeRegression,
          smooth: true,
          lineStyle: {
            color: incomeColor,
            width: 2,
            type: 'dashed',
          },
          itemStyle: {
            color: incomeColor,
          },
          showSymbol: false,
        },
        {
          name: '支出',
          type: 'line',
          data: expenseData,
          smooth: true,
          lineStyle: {
            color: expenseColor,
            width: 2,
          },
          itemStyle: {
            color: expenseColor,
          },
          showSymbol: false,
        },
        {
          name: '支出趋势',
          type: 'line',
          data: expenseRegression,
          smooth: true,
          lineStyle: {
            color: expenseColor,
            width: 2,
            type: 'dashed',
          },
          itemStyle: {
            color: expenseColor,
          },
          showSymbol: false,
        },
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [monthlyData, regression]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return (
    <div ref={chartRef} className="w-full h-[400px]" />
  );
}
