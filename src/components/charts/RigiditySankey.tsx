import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Transaction } from '@/types/transaction';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { RICH_PALETTE, UNIFIED_PALETTE } from '@/lib/colorPalette';

interface RigiditySankeyProps {
  transactions: Transaction[];
  totalIncome: number;
}

export function RigiditySankey({ transactions, totalIncome }: RigiditySankeyProps) {
  const { settings } = useSettings();
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Get colors from settings
    const incomeColor = getIncomeColorHex(settings.colorScheme);
    const expenseColor = getExpenseColorHex(settings.colorScheme);
    const savingsColor = UNIFIED_PALETTE.blue; // Blue for savings
    const fixedColor = UNIFIED_PALETTE.rose; // Rose-600 for fixed
    const flexibleColor = '#fb7185'; // Rose-400 for flexible

    // Rich color palette for primary categories (from unified palette)
    const categoryColors = RICH_PALETTE;

    // Get color for primary category based on hash
    const getCategoryColor = (category: string, isFixed: boolean): string => {
      let hash = 0;
      for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash) % categoryColors.length;
      return categoryColors[index];
    };

    // Fixed expense categories (tertiary level)
    const fixedCategoriesSet = new Set(settings.fixedExpenseCategories);

    // Calculate expenses: group by (primary, tertiary) with fixed/flexible flag
    const expenseData = new Map<string, {
      primary: string;
      tertiary: string;
      amount: number;
      isFixed: boolean;
    }>();

    let totalExpense = 0;
    let totalFixed = 0;
    let totalFlexible = 0;

    // Primary category breakdown by fixed/flexible
    const primaryFixedAmount = new Map<string, number>();
    const primaryFlexibleAmount = new Map<string, number>();

    const safeTransactions = transactions || [];
    for (const t of safeTransactions) {
      if (t.type === 'expense') {
        totalExpense += t.amount;

        const isFixed = fixedCategoriesSet.has(t.tertiaryCategory);
        if (isFixed) {
          totalFixed += t.amount;
          const current = primaryFixedAmount.get(t.primaryCategory) || 0;
          primaryFixedAmount.set(t.primaryCategory, current + t.amount);
        } else {
          totalFlexible += t.amount;
          const current = primaryFlexibleAmount.get(t.primaryCategory) || 0;
          primaryFlexibleAmount.set(t.primaryCategory, current + t.amount);
        }

        const key = `${t.primaryCategory}|${t.tertiaryCategory}|${isFixed}`;
        const existing = expenseData.get(key);
        if (existing) {
          existing.amount += t.amount;
        } else {
          expenseData.set(key, {
            primary: t.primaryCategory,
            tertiary: t.tertiaryCategory,
            amount: t.amount,
            isFixed,
          });
        }
      }
    }

    const totalSavings = Math.max(0, totalIncome - totalExpense);

    // Build nodes and links
    const nodes: any[] = [];
    const links: any[] = [];

    // Level 1: Total Income
    nodes.push({ name: '总收入', itemStyle: { color: incomeColor } });

    // Level 2: Total Expense and Total Savings
    nodes.push({ name: '总支出', itemStyle: { color: expenseColor } });
    links.push({
      source: '总收入',
      target: '总支出',
      value: totalExpense,
      lineStyle: { color: expenseColor, opacity: 0.5 },
    });

    if (totalSavings > 0) {
      nodes.push({ name: '总储蓄', itemStyle: { color: savingsColor } });
      links.push({
        source: '总收入',
        target: '总储蓄',
        value: totalSavings,
        lineStyle: { color: savingsColor, opacity: 0.5 },
      });
    }

    // Level 3: Fixed Expense and Flexible Expense
    if (totalFixed > 0) {
      nodes.push({ name: '刚性支出', itemStyle: { color: fixedColor } });
      links.push({
        source: '总支出',
        target: '刚性支出',
        value: totalFixed,
        lineStyle: { color: fixedColor, opacity: 0.5 },
      });
    }
    if (totalFlexible > 0) {
      nodes.push({ name: '弹性支出', itemStyle: { color: flexibleColor } });
      links.push({
        source: '总支出',
        target: '弹性支出',
        value: totalFlexible,
        lineStyle: { color: flexibleColor, opacity: 0.5 },
      });
    }

    // Level 4: Primary categories (split by fixed/flexible)
    // Get all unique primary categories that have either fixed or flexible expenses
    const allPrimaries = new Set([
      ...primaryFixedAmount.keys(),
      ...primaryFlexibleAmount.keys(),
    ]);

    for (const primary of allPrimaries) {
      const fixedAmt = primaryFixedAmount.get(primary) || 0;
      const flexibleAmt = primaryFlexibleAmount.get(primary) || 0;

      if (fixedAmt > 0) {
        const nodeName = `${primary}(刚)`;
        const color = getCategoryColor(primary, true);
        nodes.push({
          name: nodeName,
          itemStyle: { color },
        });
        links.push({
          source: '刚性支出',
          target: nodeName,
          value: fixedAmt,
          lineStyle: { color, opacity: 0.4 },
        });
      }

      if (flexibleAmt > 0) {
        const nodeName = `${primary}(弹)`;
        const color = getCategoryColor(primary, false);
        nodes.push({
          name: nodeName,
          itemStyle: { color },
        });
        links.push({
          source: '弹性支出',
          target: nodeName,
          value: flexibleAmt,
          lineStyle: { color, opacity: 0.4 },
        });
      }
    }

    // Level 5: Tertiary categories
    // Track which parent nodes were actually created in Level 4
    const createdParentNodes = new Set<string>();
    for (const primary of allPrimaries) {
      const fixedAmt = primaryFixedAmount.get(primary) || 0;
      const flexibleAmt = primaryFlexibleAmount.get(primary) || 0;
      if (fixedAmt > 0) {
        createdParentNodes.add(`${primary}(刚)`);
      }
      if (flexibleAmt > 0) {
        createdParentNodes.add(`${primary}(弹)`);
      }
    }

    const tertiaryEntries = Array.from(expenseData.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 30); // Limit to top 30

    for (const entry of tertiaryEntries) {
      const parentName = `${entry.primary}(${entry.isFixed ? '刚' : '弹'})`;

      // Only add link if parent node exists
      if (!createdParentNodes.has(parentName)) {
        continue;
      }

      // Use unique node name: primary + tertiary to avoid duplicates
      const uniqueNodeName = `${entry.primary}·${entry.tertiary}`;

      // Use lighter shade of parent category color
      const parentColor = getCategoryColor(entry.primary, entry.isFixed);

      nodes.push({
        name: uniqueNodeName,
        itemStyle: {
          color: parentColor,
        },
      });
      links.push({
        source: parentName,
        target: uniqueNodeName,
        value: entry.amount,
        lineStyle: { color: parentColor, opacity: 0.3 },
      });
    }

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: any) => {
          if (params.dataType === 'edge') {
            // Clean up display names (remove suffixes)
            const sourceName = params.data.source.replace('(刚)', '').replace('(弹)', '').replace('·', ' · ');
            let targetName = params.data.target;
            if (targetName.includes('·')) {
              targetName = targetName.replace('·', ' · ');
            } else {
              targetName = targetName.replace('(刚)', '').replace('(弹)', '');
            }
            const percent = totalIncome > 0
              ? ((params.data.value / totalIncome) * 100).toFixed(1)
              : '0.0';
            return `
              <div style="padding: 8px;">
                <div>${sourceName} → ${targetName}</div>
                <div>金额: ¥${params.data.value.toLocaleString()}</div>
                <div>占收入: ${percent}%</div>
              </div>
            `;
          }
          // Clean up node names
          return params.name.replace('(刚)', '').replace('(弹)', '').replace('·', ' · ');
        },
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          data: nodes,
          links: links,
          top: '5%',
          right: '5%',
          bottom: '5%',
          left: '5%',
          emphasis: {
            focus: 'adjacency',
          },
          lineStyle: {
            curveness: 0.5,
          },
          label: {
            color: 'hsl(var(--text-main))',
            fontSize: 11,
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
  }, [transactions, totalIncome, settings.fixedExpenseCategories, settings.colorScheme]);

  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
    };
  }, []);

  return (
    <div ref={chartRef} className="w-full h-[400px]" />
  );
}
