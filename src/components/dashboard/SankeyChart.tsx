import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction } from '@/types/transaction';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { formatCurrencyFull } from '@/lib/chart-config';

// ECharts Sankey label callback parameter types
interface SankeyLabelParams {
  name: string;
  value: number;
}

interface SankeyChartProps {
  transactions: Transaction[];
  type: 'income' | 'expense';
}

export function SankeyChart({ transactions, type }: SankeyChartProps) {
  const { settings } = useSettings();
  const totalColor = type === 'income' ? getIncomeColorHex(settings.colorScheme) : getExpenseColorHex(settings.colorScheme);

  const { option, total } = useMemo(() => {
    const filtered = transactions.filter(t => t.type === type);
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);

    // Group by primary -> secondary category
    const primaryMap = new Map<string, { total: number; secondary: Map<string, number> }>();

    filtered.forEach(t => {
      if (!primaryMap.has(t.primaryCategory)) {
        primaryMap.set(t.primaryCategory, { total: 0, secondary: new Map() });
      }
      const primary = primaryMap.get(t.primaryCategory)!;
      primary.total += t.amount;
      primary.secondary.set(
        t.secondaryCategory,
        (primary.secondary.get(t.secondaryCategory) || 0) + t.amount
      );
    });

    // Rich color palette for Sankey categories (all direct hex values for ECharts)
    const colors = [
      getIncomeColorHex(settings.colorScheme),
      getExpenseColorHex(settings.colorScheme),
      '#3b82f6', // Blue-500
      '#06b6d4', // Cyan-500
      '#0ea5e9', // Sky-500
      '#6366f1', // Indigo-500
      '#8b5cf6', // Violet-500
      '#a855f7', // Purple-500
      '#d946ef', // Fuchsia-500
      '#ec4899', // Pink-500
      '#f43f5e', // Rose-500
      '#ef4444', // Red-500
      '#f97316', // Orange-500
      '#f59e0b', // Amber-500
      '#eab308', // Yellow-500
      '#84cc16', // Lime-500
      '#22c55e', // Green-500
      '#10b981', // Emerald-500
      '#14b8a6', // Teal-500
      '#0891b2', // Cyan-600
      '#0284c7', // Sky-600
      '#2563eb', // Blue-600
      '#4f46e5', // Indigo-600
      '#7c3aed', // Violet-600
    ];

    // Build nodes and links for ECharts Sankey
    // Node type with optional itemStyle for direct color assignment
    const nodes: Array<{ name: string; itemStyle?: { color: string } }> = [];
    const links: Array<{ source: string | number; target: string | number; value: number }> = [];

    // Add root node
    const rootNode = type === 'income' ? '总收入' : '总支出';
    nodes.push({ name: rootNode, itemStyle: { color: totalColor } });

    // Track node names for index-based links
    const nodeNameSet = new Set<string>([rootNode]);

    let primaryIndex = 0;
    primaryMap.forEach((data, category) => {
      // Skip first 2 colors (income/expense theme colors)
      const colorIndex = primaryIndex + 2;
      const categoryColor = colors[colorIndex % colors.length];

      // Use category with index as unique identifier for display
      const categoryNode = category;
      if (!nodeNameSet.has(categoryNode)) {
        nodes.push({
          name: categoryNode,
          itemStyle: { color: categoryColor }
        });
        nodeNameSet.add(categoryNode);

        links.push({
          source: rootNode,
          target: categoryNode,
          value: data.total
        });
      }

      // Add secondary category nodes with unique names
      data.secondary.forEach((value, subCategory) => {
        // Create unique node name: "一级分类 - 二级分类"
        const uniqueSubNode = `${category} - ${subCategory}`;
        if (!nodeNameSet.has(uniqueSubNode)) {
          nodes.push({
            name: uniqueSubNode,
            itemStyle: { color: categoryColor }
          });
          nodeNameSet.add(uniqueSubNode);
        }

        links.push({
          source: categoryNode,
          target: uniqueSubNode,
          value
        });
      });

      primaryIndex++;
    });

    // Map node names to indices for ECharts
    const nodeIndexMap = new Map<string, number>();
    nodes.forEach((node, index) => {
      nodeIndexMap.set(node.name, index);
    });

    // Convert links to use indices
    const indexedLinks = links.map(link => ({
      source: nodeIndexMap.get(link.source as string)!,
      target: nodeIndexMap.get(link.target as string)!,
      value: link.value
    }));

    const option = {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: { dataType: string; name: string; value: number; data?: { source: string; target: string; value: number } }) => {
          if (params.dataType === 'node') {
            return `${params.name}: ${formatCurrencyFull(params.value)}`;
          }
          if (params.dataType === 'edge' && params.data) {
            return `${params.data.source} → ${params.data.target}: ${formatCurrencyFull(params.data.value)}`;
          }
          return '';
        }
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: {
            focus: 'adjacency'
          },
          data: nodes,
          links: indexedLinks,
          itemStyle: {
            borderColor: 'hsl(var(--background))'
          },
          lineStyle: {
            opacity: 0.4
          },
          label: {
            position: 'right',
            fontSize: 11,
            formatter: (params: SankeyLabelParams) => {
              const value = params.value;
              const percentage = ((value / total) * 100).toFixed(1);
              return `${params.name}\n${formatCurrencyFull(value)}\n${percentage}%`;
            }
          },
          levels: [{
            depth: 0,
            itemStyle: {
              color: totalColor,
              borderColor: 'hsl(var(--background))'
            },
            label: {
              fontSize: 12,
              fontWeight: 'bold'
            }
          }, {
            depth: 1,
            label: {
              fontSize: 11
            }
          }, {
            depth: 2,
            label: {
              fontSize: 10
            }
          }]
        }
      ]
    };

    return { option, total };
  }, [transactions, type, totalColor, settings]);

  if (transactions.length === 0 || total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{type === 'income' ? '收入' : '支出'}流向图</CardTitle>
          <CardDescription>展示资金流向一二级分类的分布</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            暂无{type === 'income' ? '收入' : '支出'}数据
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{type === 'income' ? '收入' : '支出'}流向图</CardTitle>
        <CardDescription>
          总{type === 'income' ? '收入' : '支出'}: {formatCurrencyFull(total)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ReactECharts
          option={option}
          style={{ height: 'calc(100vh - 240px)', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </CardContent>
    </Card>
  );
}
