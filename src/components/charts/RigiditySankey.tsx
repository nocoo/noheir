import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Transaction } from '@/types/transaction';

interface RigiditySankeyProps {
  transactions: Transaction[];
  totalIncome: number;
}

// Fixed expense categories (should match the algorithm)
const FIXED_EXPENSE_CATEGORIES = new Set([
  '房贷', '房租', '保险', '物业费', '水电燃气',
  'Mortgage', 'Rent', 'Insurance', 'Property Fee', 'Utilities'
]);

export function RigiditySankey({ transactions, totalIncome }: RigiditySankeyProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Calculate expense breakdown
    const expenseByCategory = new Map<string, number>();
    let totalFixed = 0;
    let totalFlexible = 0;

    const safeTransactions = transactions || [];
    for (const t of safeTransactions) {
      if (t.type === 'expense') {
        const current = expenseByCategory.get(t.primaryCategory) || 0;
        expenseByCategory.set(t.primaryCategory, current + t.amount);

        if (FIXED_EXPENSE_CATEGORIES.has(t.primaryCategory)) {
          totalFixed += t.amount;
        } else {
          totalFlexible += t.amount;
        }
      }
    }

    // Get top 5 expense categories
    const topCategories = Array.from(expenseByCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const totalExpense = totalFixed + totalFlexible;

    // Build sankey nodes and links
    const nodes = [
      { name: '总收入', itemStyle: { color: '#059669' } },
      { name: '总支出', itemStyle: { color: '#e11d48' } },
      { name: '刚性支出', itemStyle: { color: '#f43f5e' } },
      { name: '弹性支出', itemStyle: { color: '#fb7185' } },
      ...topCategories.map(([cat]) => ({
        name: cat,
        itemStyle: { color: '#fecdd3' },
      })),
    ];

    const links = [
      {
        source: '总收入',
        target: '总支出',
        value: totalExpense,
      },
      {
        source: '总支出',
        target: '刚性支出',
        value: totalFixed,
        lineStyle: { color: '#f43f5e', opacity: 0.6 },
      },
      {
        source: '总支出',
        target: '弹性支出',
        value: totalFlexible,
        lineStyle: { color: '#fb7185', opacity: 0.6 },
      },
      ...topCategories.map(([cat, amount]) => ({
        source: FIXED_EXPENSE_CATEGORIES.has(cat) ? '刚性支出' : '弹性支出',
        target: cat,
        value: amount,
        lineStyle: { opacity: 0.4 },
      })),
    ];

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            const percent = totalIncome > 0
              ? ((params.data.value / totalIncome) * 100).toFixed(1)
              : '0.0';
            return `
              <div style="padding: 8px;">
                <div>${params.data.source} → ${params.data.target}</div>
                <div>金额: ¥${params.data.value.toLocaleString()}</div>
                <div>占收入: ${percent}%</div>
              </div>
            `;
          }
          return params.name;
        },
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          data: nodes,
          links: links,
          top: '10%',
          right: '10%',
          bottom: '10%',
          left: '10%',
          emphasis: {
            focus: 'adjacency',
          },
          lineStyle: {
            curveness: 0.5,
          },
          label: {
            color: '#334155', // text-main color
            fontSize: 12,
          },
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
  }, [transactions, totalIncome]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return (
    <div ref={chartRef} className="w-full h-[320px]" />
  );
}
