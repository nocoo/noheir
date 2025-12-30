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
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, legendStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';

interface IncomeExpenseComparisonProps {
  data: MonthlyData[];
}

export function IncomeExpenseComparison({ data }: IncomeExpenseComparisonProps) {
  const { settings } = useSettings();
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

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
                  <stop offset="5%" stopColor={incomeColorHex} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={incomeColorHex} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={expenseColorHex} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={expenseColorHex} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis
                dataKey="month"
                {...xAxisStyle}
              />
              <YAxis
                {...yAxisStyle}
                tickFormatter={formatCurrencyK}
              />
              <Tooltip
                contentStyle={tooltipStyle.contentStyle}
                formatter={(value: number, name: string) => [
                  formatCurrencyFull(value),
                  name === 'income' ? '收入' : '支出'
                ]}
              />
              <Legend formatter={(value) => value === 'income' ? '收入' : '支出'} />
              {avgIncome > 0 && (
                <ReferenceLine
                  y={avgIncome}
                  stroke={incomeColorHex}
                  strokeDasharray="5 5"
                  label={{ value: `平均收入 ${formatCurrencyFull(avgIncome)}`, fill: incomeColorHex, fontSize: 11 }}
                />
              )}
              {avgExpense > 0 && (
                <ReferenceLine
                  y={avgExpense}
                  stroke={expenseColorHex}
                  strokeDasharray="5 5"
                  label={{ value: `平均支出 ${formatCurrencyFull(avgExpense)}`, fill: expenseColorHex, fontSize: 11 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="income"
                stroke={incomeColorHex}
                strokeWidth={2}
                fill="url(#incomeGradient)"
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke={expenseColorHex}
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
