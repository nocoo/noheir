import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction } from '@/types/transaction';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';

// ECharts Sankey callback parameter types
interface SankeyNodeParams {
  name: string;
  value: number;
}

interface SankeyEdgeParams {
  data: {
    source: string | number;
    target: string | number;
    value: number;
  };
}

interface SankeyLabelParams {
  name: string;
  value: number;
}

interface SankeyItemStyleParams {
  name: string;
  data: SankeyNodeParams;
}

interface SankeyLineStyleParams {
  data: {
    source: number;
    target: number;
    value: number;
  };
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

    // Rich color palette for Sankey categories
    const colors = [
      getIncomeColorHex(settings.colorScheme),
      getExpenseColorHex(settings.colorScheme),
      'hsl(var(--chart-1))',  // Blue
      'hsl(var(--chart-2))',  // Cyan
      'hsl(var(--chart-3))',  // Indigo
      'hsl(var(--chart-4))',  // Violet
      'hsl(var(--chart-5))',  // Purple
      '#06b6d4', // Cyan-500
      '#0ea5e9', // Sky-500
      '#3b82f6', // Blue-500
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
    ];

    // Build nodes and links for ECharts Sankey
    const nodes: Array<{ name: string }> = [];
    const links: Array<{ source: string | number; target: string | number; value: number }> = [];

    // Add root node
    const rootNode = type === 'income' ? '总收入' : '总支出';
    nodes.push({ name: rootNode });

    // Track node names for index-based links
    const nodeNameSet = new Set<string>([rootNode]);

    let colorIndex = 0;
    primaryMap.forEach((data, category) => {
      // Use category with index as unique identifier for display
      const categoryNode = category;
      if (!nodeNameSet.has(categoryNode)) {
        nodes.push({ name: categoryNode });
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
          nodes.push({ name: uniqueSubNode });
          nodeNameSet.add(uniqueSubNode);
        }

        links.push({
          source: categoryNode,
          target: uniqueSubNode,
          value
        });
      });

      colorIndex++;
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
            return `${params.name}: ¥${params.value.toLocaleString()}`;
          }
          if (params.dataType === 'edge' && params.data) {
            return `${params.data.source} → ${params.data.target}: ¥${params.data.value.toLocaleString()}`;
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
            color: (params: SankeyItemStyleParams) => {
              const nodeName = params.name;
              if (nodeName === rootNode) {
                return totalColor;
              }
              // Use consistent colors based on primary category
              const primaryIndex = Array.from(primaryMap.keys()).findIndex(cat => {
                const categoryNode = cat;
                return nodeName === categoryNode || nodeNameSet.has(nodeName) &&
                       nodes.some(n => n.name === nodeName && links.some(l =>
                         (l.source === categoryNode || l.target === categoryNode) &&
                         (l.source === nodeName || l.target === nodeName)
                       ));
              });
              if (primaryIndex >= 0) {
                return colors[primaryIndex % colors.length];
              }
              return colors[colorIndex % colors.length];
            },
            borderColor: 'hsl(var(--background))'
          },
          lineStyle: {
            color: (params: SankeyLineStyleParams) => {
              // Find the source node's color
              const sourceNode = nodes[params.data.source];
              const sourceColor = sourceNode?.name === rootNode ? totalColor :
                colors[Math.floor((params.data.source - 1) / 10) % colors.length];
              return sourceColor || 'hsl(var(--muted-foreground))';
            },
            opacity: 0.3
          },
          label: {
            position: 'right',
            fontSize: 11,
            formatter: (params: SankeyLabelParams) => {
              const value = params.value;
              const percentage = ((value / total) * 100).toFixed(1);
              return `${params.name}\n¥${value.toLocaleString()}\n${percentage}%`;
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
          总{type === 'income' ? '收入' : '支出'}: ¥{total.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ReactECharts
          option={option}
          style={{ height: '1400px', width: '100%' }}
          opts={{ renderer: 'svg' }}
        />
      </CardContent>
    </Card>
  );
}
