import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction } from '@/types/transaction';

interface SankeyChartProps {
  transactions: Transaction[];
  type: 'income' | 'expense';
}

interface SankeyNode {
  name: string;
  value: number;
  color: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export function SankeyChart({ transactions, type }: SankeyChartProps) {
  const { nodes, links, total } = useMemo(() => {
    const filtered = transactions.filter(t => t.type === type);
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);
    
    // Group by primary category
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

    const colors = [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))',
    ];

    const nodes: SankeyNode[] = [];
    const links: SankeyLink[] = [];
    
    // Add total node
    nodes.push({
      name: type === 'income' ? '总收入' : '总支出',
      value: total,
      color: type === 'income' ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'
    });

    // Add primary category nodes and links
    let colorIndex = 0;
    primaryMap.forEach((data, category) => {
      nodes.push({
        name: category,
        value: data.total,
        color: colors[colorIndex % colors.length]
      });
      
      links.push({
        source: type === 'income' ? '总收入' : '总支出',
        target: category,
        value: data.total
      });

      // Add secondary category nodes and links
      data.secondary.forEach((value, subCategory) => {
        const subName = `${category}-${subCategory}`;
        nodes.push({
          name: subName,
          value,
          color: colors[colorIndex % colors.length]
        });
        
        links.push({
          source: category,
          target: subName,
          value
        });
      });

      colorIndex++;
    });

    return { nodes, links, total };
  }, [transactions, type]);

  // Calculate layout positions
  const layout = useMemo(() => {
    const width = 800;
    const height = 500;
    const nodeWidth = 20;
    const padding = 40;
    
    // Group nodes by level
    const totalNode = nodes.find(n => n.name === (type === 'income' ? '总收入' : '总支出'));
    const primaryNodes = nodes.filter(n => 
      links.some(l => l.source === (type === 'income' ? '总收入' : '总支出') && l.target === n.name)
    );
    const secondaryNodes = nodes.filter(n => 
      n !== totalNode && !primaryNodes.includes(n)
    );

    // Calculate positions
    const positions = new Map<string, { x: number; y: number; height: number }>();
    
    // Total node (left)
    if (totalNode) {
      positions.set(totalNode.name, {
        x: padding,
        y: height / 2 - (height - 2 * padding) / 2,
        height: height - 2 * padding
      });
    }

    // Primary nodes (middle)
    const primaryTotal = primaryNodes.reduce((s, n) => s + n.value, 0);
    let primaryY = padding;
    primaryNodes.forEach(node => {
      const nodeHeight = ((node.value / primaryTotal) * (height - 2 * padding - primaryNodes.length * 10));
      positions.set(node.name, {
        x: width / 2 - nodeWidth / 2,
        y: primaryY,
        height: Math.max(nodeHeight, 20)
      });
      primaryY += nodeHeight + 10;
    });

    // Secondary nodes (right)
    let secondaryY = padding;
    const secondaryTotal = secondaryNodes.reduce((s, n) => s + n.value, 0);
    secondaryNodes.forEach(node => {
      const nodeHeight = ((node.value / secondaryTotal) * (height - 2 * padding - secondaryNodes.length * 5));
      positions.set(node.name, {
        x: width - padding - nodeWidth,
        y: secondaryY,
        height: Math.max(nodeHeight, 15)
      });
      secondaryY += nodeHeight + 5;
    });

    return { width, height, nodeWidth, positions, primaryNodes, secondaryNodes };
  }, [nodes, links, type]);

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
        <div className="overflow-x-auto">
          <svg 
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="w-full min-w-[600px]"
            style={{ maxHeight: '500px' }}
          >
            {/* Draw links */}
            {links.map((link, i) => {
              const sourcePos = layout.positions.get(link.source);
              const targetPos = layout.positions.get(link.target);
              if (!sourcePos || !targetPos) return null;

              const sourceX = sourcePos.x + layout.nodeWidth;
              const sourceY = sourcePos.y + sourcePos.height / 2;
              const targetX = targetPos.x;
              const targetY = targetPos.y + targetPos.height / 2;

              const path = `M ${sourceX} ${sourceY} 
                           C ${sourceX + (targetX - sourceX) / 2} ${sourceY},
                             ${sourceX + (targetX - sourceX) / 2} ${targetY},
                             ${targetX} ${targetY}`;

              const node = nodes.find(n => n.name === link.target);
              const opacity = 0.3 + (link.value / total) * 0.4;

              return (
                <g key={i}>
                  <path
                    d={path}
                    fill="none"
                    stroke={node?.color || 'hsl(var(--muted-foreground))'}
                    strokeWidth={Math.max(2, (link.value / total) * 30)}
                    strokeOpacity={opacity}
                    className="transition-all hover:stroke-opacity-80"
                  />
                </g>
              );
            })}

            {/* Draw nodes */}
            {nodes.map((node, i) => {
              const pos = layout.positions.get(node.name);
              if (!pos) return null;

              const displayName = node.name.includes('-') 
                ? node.name.split('-')[1] 
                : node.name;

              return (
                <g key={i}>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={layout.nodeWidth}
                    height={pos.height}
                    fill={node.color}
                    rx={4}
                    className="transition-all hover:opacity-80"
                  />
                  <text
                    x={pos.x + layout.nodeWidth + 8}
                    y={pos.y + pos.height / 2}
                    dy="0.35em"
                    fontSize="11"
                    fill="currentColor"
                    className="text-foreground"
                  >
                    {displayName}
                  </text>
                  <text
                    x={pos.x + layout.nodeWidth + 8}
                    y={pos.y + pos.height / 2 + 14}
                    dy="0.35em"
                    fontSize="9"
                    fill="currentColor"
                    className="text-muted-foreground"
                  >
                    ¥{node.value.toLocaleString()}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {layout.primaryNodes.map((node, i) => (
              <div key={i} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm" 
                  style={{ backgroundColor: node.color }}
                />
                <span className="text-sm">{node.name}</span>
                <span className="text-sm text-muted-foreground ml-auto">
                  {((node.value / total) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
