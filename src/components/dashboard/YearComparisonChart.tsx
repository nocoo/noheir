import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { YearlyComparison } from '@/types/transaction';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';

interface YearComparisonChartProps {
  data: YearlyComparison[];
}

export function YearComparisonChart({ data }: YearComparisonChartProps) {
  const { settings } = useSettings();
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  const chartData = data.map(item => ({
    year: item.year.toString(),
    收入: item.totalIncome,
    支出: item.totalExpense,
    结余: item.balance,
    balancePositive: item.balance >= 0,
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
              <Bar dataKey="收入" fill={incomeColorHex} radius={[4, 4, 0, 0]} />
              <Bar dataKey="支出" fill={expenseColorHex} radius={[4, 4, 0, 0]} />
              <Bar dataKey="结余" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`balance-${index}`}
                    fill={entry.balancePositive ? incomeColorHex : expenseColorHex}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
