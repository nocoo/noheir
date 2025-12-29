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

interface BalanceWaterfallProps {
  data: MonthlyData[];
}

export function BalanceWaterfall({ data }: BalanceWaterfallProps) {
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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
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
                formatter={(value: number, name: string) => {
                  if (name === 'balance') return [`¥${value.toLocaleString()}`, '月结余'];
                  if (name === 'cumulative') return [`¥${value.toLocaleString()}`, '累计结余'];
                  return [value, name];
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />
              <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isPositive ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Cumulative Balance Display */}
        <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-accent/50 rounded-lg">
          <span className="text-sm text-muted-foreground">年度累计结余:</span>
          <span className={`text-xl font-bold ${cumulativeBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
            ¥{cumulativeBalance.toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
