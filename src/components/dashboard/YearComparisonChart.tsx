import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { YearlyComparison } from '@/types/transaction';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, legendStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';
import { chartBalance, chart } from '@/lib/palette';
import { MultiSeriesTooltip } from '@/lib/chart-tooltip';
import { useYearComparisonViewModel } from '@/viewmodels/dashboard/useYearComparisonViewModel';

interface YearComparisonChartProps {
  data: YearlyComparison[];
}

export function YearComparisonChart({ data }: YearComparisonChartProps) {
  const {
    incomeColorHex,
    expenseColorHex,
    targetSavingsRate,
    chartData,
    targetLineColor,
  } = useYearComparisonViewModel({ data });

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
              <Bar yAxisId="left" dataKey="结余" fill={chartBalance} radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="储蓄率"
                stroke={chart.purple}
                strokeWidth={3}
                dot={{ fill: chart.purple, r: 5, strokeWidth: 2 }}
                activeDot={{ r: 7, stroke: chart.purple, strokeWidth: 2 }}
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
