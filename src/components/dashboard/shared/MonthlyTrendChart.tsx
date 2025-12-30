import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { MonthlyData } from '@/types/transaction';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';

export interface MonthlyTrendChartProps {
  title: string;
  description: string;
  monthlyData: MonthlyData[];
  averageValue: number;
  colorHex: string;
  dataKey: 'income' | 'expense';
  icon: typeof TrendingUp | typeof TrendingDown;
}

export function MonthlyTrendChart({
  title,
  description,
  monthlyData,
  averageValue,
  colorHex,
  dataKey,
  icon: Icon,
}: MonthlyTrendChartProps) {
  const gradientId = `${dataKey}Gradient`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorHex} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={colorHex} stopOpacity={0}/>
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
                formatter={(value: number) => [formatCurrencyFull(value), dataKey === 'income' ? '收入' : '支出']}
                contentStyle={tooltipStyle.contentStyle}
              />
              <ReferenceLine
                y={averageValue}
                stroke={colorHex}
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `平均 ${formatCurrencyFull(averageValue)}`, fill: colorHex, fontSize: 11, position: 'right' }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={colorHex}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
