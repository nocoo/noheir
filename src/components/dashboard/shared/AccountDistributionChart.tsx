import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { CreditCard } from 'lucide-react';
import { AccountData } from '@/types/category-shared';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, formatCurrencyK } from '@/lib/chart-config';

interface TooltipPayload {
  payload: {
    percentage?: number;
  };
}

export interface AccountDistributionChartProps {
  title: string;
  description: string;
  accountData: AccountData[];
  colorHex: string;
  layout: 'horizontal' | 'vertical';
}

export function AccountDistributionChart({
  title,
  description,
  accountData,
  colorHex,
  layout,
}: AccountDistributionChartProps) {
  const isVertical = layout === 'vertical';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={accountData}
              layout={layout}
              margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
            >
              <CartesianGrid {...gridStyle} />
              <XAxis
                type={isVertical ? 'number' : 'category'}
                dataKey={isVertical ? undefined : 'name'}
                {...xAxisStyle}
                tickFormatter={isVertical ? formatCurrencyK : undefined}
              />
              <YAxis
                type={isVertical ? 'category' : 'number'}
                dataKey={isVertical ? 'name' : undefined}
                width={isVertical ? 100 : undefined}
                {...yAxisStyle}
                tickFormatter={isVertical ? undefined : formatCurrencyK}
              />
              <Tooltip
                formatter={(value: number, name: string, props: TooltipPayload) => [
                  `¥${value.toLocaleString()}${props.payload.percentage ? ` (${props.payload.percentage.toFixed(1)}%)` : ''}`,
                  '金额'
                ]}
                contentStyle={tooltipStyle.contentStyle}
              />
              <Bar
                dataKey="value"
                fill={colorHex}
                radius={isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
