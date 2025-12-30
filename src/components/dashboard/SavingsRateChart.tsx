import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  Bar,
  Cell
} from 'recharts';
import { MonthlyData } from '@/types/transaction';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { Badge } from '@/components/ui/badge';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';

interface SavingsRateChartProps {
  data: MonthlyData[];
}

interface TooltipPayload {
  payload?: {
    savings: number;
  };
}

export function SavingsRateChart({ data }: SavingsRateChartProps) {
  const { settings } = useSettings();
  const targetSavingsRate = settings.targetSavingsRate;
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  const chartData = data.map(item => ({
    ...item,
    savingsRate: item.income > 0 ? ((item.income - item.expense) / item.income) * 100 : 0,
    savings: item.income - item.expense,
  }));

  const avgSavingsRate = chartData.reduce((sum, d) => sum + d.savingsRate, 0) / chartData.filter(d => d.income > 0).length || 0;
  const totalSavings = chartData.reduce((sum, d) => sum + d.savings, 0);
  const bestMonth = chartData.reduce((best, curr) => curr.savingsRate > best.savingsRate ? curr : best, chartData[0]);
  const worstMonth = chartData.reduce((worst, curr) =>
    curr.income > 0 && curr.savingsRate < worst.savingsRate ? curr : worst,
    chartData.find(d => d.income > 0) || chartData[0]
  );

  // Calculate difference from target
  const avgDiff = avgSavingsRate - targetSavingsRate;
  const totalIncome = chartData.reduce((sum, d) => sum + d.income, 0);
  // Calculate savings gap based on avgSavingsRate diff to keep consistency
  // This shows: if avg rate is 4.9% below target, how much amount is that
  const savingsGap = totalIncome * (avgDiff / 100);

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>储蓄率分析</CardTitle>
        <CardDescription>月度储蓄率趋势和累计储蓄</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-muted-foreground">平均储蓄率</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-primary">{avgSavingsRate.toFixed(1)}%</p>
              <Badge variant={avgDiff >= 0 ? "default" : "destructive"} className="text-xs">
                {avgDiff >= 0 ? '+' : ''}{avgDiff.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">目标: {targetSavingsRate}%</p>
          </div>
          <div className="p-4 rounded-lg bg-accent border border-border">
            <p className="text-sm text-muted-foreground">累计储蓄</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-accent-foreground">{formatCurrencyFull(totalSavings)}</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={savingsGap >= 0 ? "default" : "destructive"} className="text-xs">
                {savingsGap >= 0 ? '+' : ''}{formatCurrencyFull(Math.abs(savingsGap))}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {savingsGap >= 0 ? '超额完成' : '还差'}
              </p>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              最佳月份 <TrendingUp className="h-3 w-3 text-primary" />
            </p>
            <p className="text-lg font-semibold">{bestMonth?.month}</p>
            <p className="text-sm text-primary">{bestMonth?.savingsRate.toFixed(1)}%</p>
          </div>
          <div className="p-4 rounded-lg bg-card border border-border">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              待改善月份 <TrendingDown className="h-3 w-3 text-destructive" />
            </p>
            <p className="text-lg font-semibold">{worstMonth?.month}</p>
            <p className="text-sm text-destructive">{worstMonth?.savingsRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis
                dataKey="month"
                {...xAxisStyle}
              />
              <YAxis
                yAxisId="left"
                {...yAxisStyle}
                tickFormatter={(value) => `${value}%`}
                domain={[-50, 100]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                {...yAxisStyle}
                tickFormatter={formatCurrencyK}
              />
              <Tooltip
                contentStyle={tooltipStyle.contentStyle}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string, props: TooltipPayload) => {
                  if (name === 'savingsRate') {
                    const isPositive = props.payload?.savings >= 0;
                    const color = isPositive ? incomeColorHex : expenseColorHex;
                    return [
                      <span style={{ color }}>{value.toFixed(1)}%</span>,
                      '储蓄率'
                    ];
                  }
                  if (name === 'savings') return [formatCurrencyFull(value), '储蓄额'];
                  return [value, name];
                }}
              />
              <ReferenceLine
                yAxisId="left"
                y={0}
                stroke="hsl(var(--destructive))"
                strokeDasharray="3 3"
              />
              <ReferenceLine
                yAxisId="left"
                y={avgSavingsRate}
                stroke="hsl(var(--primary))"
                strokeDasharray="5 5"
                label={{ value: `平均 ${avgSavingsRate.toFixed(1)}%`, fill: 'hsl(var(--primary))', fontSize: 11 }}
              />
              <ReferenceLine
                yAxisId="left"
                y={targetSavingsRate}
                stroke="hsl(var(--chart-3))"
                strokeDasharray="3 3"
                strokeWidth={2}
                label={{
                  value: `目标 ${targetSavingsRate}%`,
                  fill: 'hsl(var(--chart-3))',
                  fontSize: 11,
                  position: 'insideTopRight'
                }}
              />
              <Bar
                yAxisId="right"
                dataKey="savings"
                opacity={0.6}
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.savings >= 0 ? incomeColorHex : expenseColorHex}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="left"
                type="monotone" 
                dataKey="savingsRate" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
