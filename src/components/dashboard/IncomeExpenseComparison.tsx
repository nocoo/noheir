import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine 
} from 'recharts';
import { MonthlyData } from '@/types/transaction';

interface IncomeExpenseComparisonProps {
  data: MonthlyData[];
}

export function IncomeExpenseComparison({ data }: IncomeExpenseComparisonProps) {
  const avgIncome = data.reduce((sum, d) => sum + d.income, 0) / data.filter(d => d.income > 0).length || 0;
  const avgExpense = data.reduce((sum, d) => sum + d.expense, 0) / data.filter(d => d.expense > 0).length || 0;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>收支趋势对比</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  color: 'hsl(var(--foreground))'
                }}
                formatter={(value: number, name: string) => [
                  `¥${value.toLocaleString()}`, 
                  name === 'income' ? '收入' : '支出'
                ]}
              />
              <Legend formatter={(value) => value === 'income' ? '收入' : '支出'} />
              {avgIncome > 0 && (
                <ReferenceLine 
                  y={avgIncome} 
                  stroke="hsl(var(--primary))" 
                  strokeDasharray="5 5" 
                  label={{ value: `平均收入 ¥${avgIncome.toLocaleString()}`, fill: 'hsl(var(--primary))', fontSize: 11 }}
                />
              )}
              {avgExpense > 0 && (
                <ReferenceLine 
                  y={avgExpense} 
                  stroke="hsl(var(--chart-5))" 
                  strokeDasharray="5 5" 
                  label={{ value: `平均支出 ¥${avgExpense.toLocaleString()}`, fill: 'hsl(var(--chart-5))', fontSize: 11 }}
                />
              )}
              <Area 
                type="monotone" 
                dataKey="income" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fill="url(#incomeGradient)"
              />
              <Area 
                type="monotone" 
                dataKey="expense" 
                stroke="hsl(var(--chart-5))" 
                strokeWidth={2}
                fill="url(#expenseGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
