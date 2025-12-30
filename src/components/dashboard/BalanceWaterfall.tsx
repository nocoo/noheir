import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { MonthlyData } from '@/types/transaction';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';

interface TooltipPayload {
  payload?: {
    isPositive: boolean;
  };
}

interface BalanceWaterfallProps {
  data: MonthlyData[];
}

export function BalanceWaterfall({ data }: BalanceWaterfallProps) {
  const { settings } = useSettings();
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  let cumulativeBalance = 0;
  const waterfallData = data.map((item, index) => {
    const prevBalance = cumulativeBalance;
    cumulativeBalance += item.balance;
    return {
      month: item.month,
      balance: item.balance,
      cumulative: cumulativeBalance,
      start: prevBalance,
      isPositive: item.balance >= 0,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>月度结余瀑布图</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={waterfallData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
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
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string, props: TooltipPayload) => {
                  if (name === 'balance') {
                    const color = props.payload?.isPositive ? incomeColorHex : expenseColorHex;
                    return [
                      <span style={{ color }}>{formatCurrencyFull(value)}</span>,
                      '月结余'
                    ];
                  }
                  if (name === 'cumulative') return [formatCurrencyFull(value), '累计结余'];
                  return [value, name];
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />
              <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isPositive ? incomeColorHex : expenseColorHex}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cumulative Balance Display */}
        <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-accent/50 rounded-lg">
          <span className="text-sm text-muted-foreground">年度累计结余:</span>
          <span className={`text-xl font-bold ${cumulativeBalance >= 0 ? incomeColorClass : expenseColorClass}`}>
            {formatCurrencyFull(cumulativeBalance)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
