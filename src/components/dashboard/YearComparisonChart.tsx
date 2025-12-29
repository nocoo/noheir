import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { YearlyComparison } from '@/types/transaction';

interface YearComparisonChartProps {
  data: YearlyComparison[];
}

export function YearComparisonChart({ data }: YearComparisonChartProps) {
  const chartData = data.map(item => ({
    year: item.year.toString(),
    收入: item.totalIncome,
    支出: item.totalExpense,
    结余: item.balance,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>年度对比分析</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="year" 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)'
                }}
                formatter={(value: number) => [`¥${value.toLocaleString()}`, '']}
              />
              <Legend />
              <Bar dataKey="收入" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="支出" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="结余" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
