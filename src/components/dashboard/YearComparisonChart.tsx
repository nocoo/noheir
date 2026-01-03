import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { YearlyComparison } from '@/types/transaction';
import { useSettings, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, legendStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';
import { BALANCE_COLOR } from '@/lib/colorPalette';
import { MultiSeriesTooltip } from '@/lib/chart-tooltip';

interface YearComparisonChartProps {
  data: YearlyComparison[];
}

export function YearComparisonChart({ data }: YearComparisonChartProps) {
  const { settings } = useSettings();
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);
  const targetSavingsRate = settings.targetSavingsRate;

  // Use green color for target line (same as income color)
  const targetLineColor = '#059669';  // Emerald-600

  const chartData = data.map(item => {
    const savingsRate = item.totalIncome > 0
      ? ((item.totalIncome - item.totalExpense) / item.totalIncome) * 100
      : 0;
    return {
      year: item.year.toString(),
      收入: item.totalIncome,
      支出: item.totalExpense,
      结余: item.balance,
      储蓄率: savingsRate,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>年度对比分析</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid {...gridStyle} />
              <XAxis
                dataKey="year"
                {...xAxisStyle}
              />
              <YAxis
                yAxisId="left"
                {...yAxisStyle}
                tickFormatter={formatCurrencyK}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                width={10}
                {...yAxisStyle}
                tickFormatter={(value) => `${value}%`}
                domain={[0, 100]}
              />
              <Tooltip content={<MultiSeriesTooltip />} />
              <Legend {...legendStyle} />
              <Bar yAxisId="left" dataKey="收入" fill={incomeColorHex} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="支出" fill={expenseColorHex} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="结余" fill={BALANCE_COLOR} radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="储蓄率"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2 }}
                activeDot={{ r: 7, stroke: '#8b5cf6', strokeWidth: 2 }}
                connectNulls={true}
              />
              <ReferenceLine
                yAxisId="right"
                y={targetSavingsRate}
                stroke={targetLineColor}
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: `目标 ${targetSavingsRate}%`,
                  fill: targetLineColor,
                  fontSize: 11,
                  position: 'insideTopRight',
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
