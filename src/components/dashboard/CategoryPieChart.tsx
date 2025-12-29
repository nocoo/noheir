import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CategorySummary } from '@/types/transaction';
import { tooltipStyle, legendStyle } from '@/lib/chart-config';

interface CategoryPieChartProps {
  data: CategorySummary[];
  title?: string;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
];

export function CategoryPieChart({ data, title = '支出分类占比' }: CategoryPieChartProps) {
  const total = data.reduce((sum, item) => sum + item.total, 0);
  const THRESHOLD = 5; // 5% threshold

  // Group small categories into "其他"
  const processedData = data.reduce((acc, item) => {
    const percentage = (item.total / total) * 100;
    if (percentage >= THRESHOLD) {
      acc.major.push({ name: item.category, value: item.total, percentage });
    } else {
      acc.othersTotal += item.total;
    }
    return acc;
  }, { major: [] as Array<{ name: string; value: number; percentage: number }>, othersTotal: 0 });

  const chartData = [...processedData.major];
  if (processedData.othersTotal > 0) {
    chartData.push({
      name: '其他',
      value: processedData.othersTotal,
      percentage: (processedData.othersTotal / total) * 100,
    });
  }

  const renderLabel = (entry: any) => {
    return `${entry.name} ${entry.percentage.toFixed(0)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={renderLabel}
                labelLine={false}
                labelStyle={{ fontSize: '11px', fontWeight: 500 }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle.contentStyle}
                formatter={(value: number, name: string, props: any) => [
                  `¥${value.toLocaleString()} (${props.payload.percentage.toFixed(1)}%)`,
                  name
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={60}
                iconType="circle"
                formatter={(value, entry: any) => (
                  <span style={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}>
                    {value} ({entry.payload.percentage.toFixed(1)}%)
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
