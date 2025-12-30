import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { useSettings, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import type { PieLabelEntry } from '@/types/category-shared';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { ArrowRightLeft, CreditCard, Calendar, Wallet, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, legendStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';

interface TransferAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
}

export function TransferAnalysis({ transactions, monthlyData }: TransferAnalysisProps) {
  const { settings } = useSettings();
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const incomeColorHex = getExpenseColorHex(settings.colorScheme) === '#22c55e' ? '#3b82f6' : '#22c55e';
  const incomeColorClass = getExpenseColor(settings.colorScheme) === '#22c55e' ? 'text-blue-500' : 'text-green-500';

  const transferTransactions = useMemo(() =>
    transactions.filter(t => t.type === 'transfer'),
    [transactions]
  );

  // 转账 vs 信用卡还款分类
  const creditCardRepayments = useMemo(() =>
    transferTransactions.filter(t => t.secondaryCategory === '信用卡还款' || t.description?.includes('还款')),
    [transferTransactions]
  );

  const regularTransfers = useMemo(() =>
    transferTransactions.filter(t => !(t.secondaryCategory === '信用卡还款' || t.description?.includes('还款'))),
    [transferTransactions]
  );

  const totalTransferAmount = useMemo(() =>
    transferTransactions.reduce((sum, t) => sum + t.amount, 0),
    [transferTransactions]
  );

  const creditCardRepaymentAmount = useMemo(() =>
    creditCardRepayments.reduce((sum, t) => sum + t.amount, 0),
    [creditCardRepayments]
  );

  // 按账户统计转账
  const transferByAccount = useMemo(() => {
    const accountMap = new Map<string, { amount: number; count: number; repaymentAmount: number }>();

    transferTransactions.forEach(t => {
      if (!accountMap.has(t.account)) {
        accountMap.set(t.account, { amount: 0, count: 0, repaymentAmount: 0 });
      }
      const data = accountMap.get(t.account)!;
      data.count++;
      data.amount += t.amount;

      if (t.secondaryCategory === '信用卡还款' || t.description?.includes('还款')) {
        data.repaymentAmount += t.amount;
      }
    });

    return Array.from(accountMap.entries())
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        repaymentAmount: data.repaymentAmount
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transferTransactions]);

  // 月度转账数据
  const monthlyTransferData = useMemo(() => {
    const monthMap = new Map<number, { amount: number; count: number; repaymentAmount: number }>();

    transferTransactions.forEach(t => {
      const month = t.month;
      if (!monthMap.has(month)) {
        monthMap.set(month, { amount: 0, count: 0, repaymentAmount: 0 });
      }
      const data = monthMap.get(month)!;
      data.amount += t.amount;
      data.count++;

      if (t.secondaryCategory === '信用卡还款' || t.description?.includes('还款')) {
        data.repaymentAmount += t.amount;
      }
    });

    return Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month: `${month}月`,
        总转账: data.amount,
        转账笔数: data.count,
        信用卡还款: data.repaymentAmount,
        其他转账: data.amount - data.repaymentAmount
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [transferTransactions]);

  // 转账分类分布
  const categoryData = [
    { name: '信用卡还款', value: creditCardRepaymentAmount, percentage: totalTransferAmount > 0 ? (creditCardRepaymentAmount / totalTransferAmount) * 100 : 0 },
    { name: '其他转账', value: totalTransferAmount - creditCardRepaymentAmount, percentage: totalTransferAmount > 0 ? ((totalTransferAmount - creditCardRepaymentAmount) / totalTransferAmount) * 100 : 0 }
  ];

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  if (transferTransactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">暂无转账数据</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="总转账金额"
          value={totalTransferAmount}
          icon={ArrowRightLeft}
          variant="expense"
        />
        <StatCard
          title="转账笔数"
          value={transferTransactions.length}
          icon={Wallet}
          showCurrency={false}
        />
        <StatCard
          title="信用卡还款"
          value={creditCardRepaymentAmount}
          icon={CreditCard}
          variant="expense"
        />
        <StatCard
          title="其他转账"
          value={totalTransferAmount - creditCardRepaymentAmount}
          icon={TrendingUp}
          variant="expense"
        />
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            月度转账趋势
          </CardTitle>
          <CardDescription>每月转账金额变化</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTransferData}>
                <defs>
                  <linearGradient id="transferGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={expenseColorHex} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={expenseColorHex} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...xAxisStyle} />
                <YAxis {...yAxisStyle} tickFormatter={formatCurrencyK} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name]}
                  contentStyle={tooltipStyle.contentStyle}
                />
                <Area
                  type="monotone"
                  dataKey="总转账"
                  stroke={expenseColorHex}
                  strokeWidth={2}
                  fill="url(#transferGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>转账分类分布</CardTitle>
            <CardDescription>信用卡还款 vs 其他转账</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={(entry: PieLabelEntry) => `${entry.name} ${entry.percentage.toFixed(0)}%`}
                    labelLine={false}
                    labelStyle={{ fontSize: '12px', fontWeight: 500 }}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrencyFull(value), '金额']}
                    contentStyle={tooltipStyle.contentStyle}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend {...legendStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Transfer by Account */}
        <Card>
          <CardHeader>
            <CardTitle>账户转账统计</CardTitle>
            <CardDescription>各账户转账金额排行</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={transferByAccount.slice(0, 10)} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis type="number" {...xAxisStyle} tickFormatter={formatCurrencyK} />
                  <YAxis type="category" dataKey="name" width={120} {...yAxisStyle} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrencyFull(value), '转账金额']}
                    contentStyle={tooltipStyle.contentStyle}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="amount" fill={expenseColorHex} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Transfer Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            月度转账明细
          </CardTitle>
          <CardDescription>每月转账及信用卡还款详情</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTransferData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="month" {...xAxisStyle} />
                <YAxis {...yAxisStyle} tickFormatter={formatCurrencyK} />
                <Tooltip
                  formatter={(value: number) => [formatCurrencyFull(value), '']}
                  contentStyle={tooltipStyle.contentStyle}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend {...legendStyle} />
                <Bar dataKey="信用卡还款" fill={colors[0]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="其他转账" fill={colors[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>转账明细表</CardTitle>
          <CardDescription>所有转账记录详情</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>账户</TableHead>
                <TableHead>二级分类</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="text-right">金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transferTransactions
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 100)
                .map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{t.date}</TableCell>
                    <TableCell>{t.account}</TableCell>
                    <TableCell className="text-muted-foreground">{t.secondaryCategory || '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.description || '-'}</TableCell>
                    <TableCell className={`text-right font-semibold ${expenseColorClass}`}>
                      {formatCurrencyFull(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
