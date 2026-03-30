import { Transaction } from '@/types/transaction';
import { StatCard } from './StatCard';
import { getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex, ACCOUNT_TYPE_CONFIG } from '@/contexts/SettingsContext';
import { useAccountAnalysisViewModel } from '@/viewmodels/dashboard/useAccountAnalysisViewModel';
import type { PieLabelEntry } from '@/types/category-shared';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Wallet, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, legendStyle, formatCurrencyK, formatCurrencyFull } from '@/lib/chart-config';
import { ChartCard } from '@/components/shared';
import { gridContainer, gridItem } from '@/lib/animations';
import { Button } from '@/components/ui/button';
import { CreditCard } from 'lucide-react';

interface AccountAnalysisProps {
  transactions: Transaction[];
}

export function AccountAnalysis({ transactions }: AccountAnalysisProps) {
  const {
    settings,
    groupBy,
    setGroupBy,
    accountData,
    accountGroups,
    chartData,
    pieData,
    topTransactionCounts,
    summaryStats,
  } = useAccountAnalysisViewModel({ transactions });

  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  if (transactions.length === 0) {
    return (
      <ChartCard title="账户分析">
        <div className="text-center py-8 text-muted-foreground">暂无数据</div>
      </ChartCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <motion.div
        variants={gridContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <motion.div variants={gridItem}>
            <StatCard
              title="账户数量"
              value={summaryStats.accountCount}
              icon={Wallet}
              showCurrency={false}
            />
        </motion.div>
        <motion.div variants={gridItem}>
            <StatCard
              title="总资金流动"
              value={summaryStats.totalFlow}
              icon={ArrowUpDown}
            />
        </motion.div>
        <motion.div variants={gridItem}>
            <StatCard
              title="净流入"
              value={summaryStats.totalIncome}
              icon={TrendingUp}
              variant="income"
            />
        </motion.div>
        <motion.div variants={gridItem}>
            <StatCard
              title="净流出"
              value={summaryStats.totalExpense}
              icon={TrendingDown}
              variant="expense"
            />
        </motion.div>
      </motion.div>

      {/* Account Comparison */}
      <ChartCard
        title="账户收支对比"
        description="各账户收入支出情况"
      >
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="name" {...xAxisStyle} />
                <YAxis tickFormatter={formatCurrencyK} {...yAxisStyle} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrencyFull(value), name]}
                  contentStyle={tooltipStyle.contentStyle}
                />
                <Legend {...legendStyle} />
                <Bar dataKey="收入" fill={incomeColorHex} radius={[4, 4, 0, 0]} />
                <Bar dataKey="支出" fill={expenseColorHex} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Distribution */}
        <ChartCard
          title="交易量分布"
          description="各账户交易活跃度"
        >
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={(entry: PieLabelEntry) => `${entry.name} ${entry.percentage.toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrencyFull(value), '金额']}
                    contentStyle={tooltipStyle.contentStyle}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={60}
                    iconType="circle"
                    formatter={(value, entry) => {
                      const payload = (entry as { payload?: { percentage?: number } }).payload;
                      return (
                        <span style={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}>
                          {value} ({(payload?.percentage ?? 0).toFixed(1)}%)
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
        </ChartCard>

        {/* Top 20 Transaction Counts */}
        <ChartCard
          title="交易次数排行"
          description="Top 20 账户交易频率"
        >
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTransactionCounts} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                  <CartesianGrid {...gridStyle} />
                  <XAxis type="number" {...xAxisStyle} />
                  <YAxis type="category" dataKey="name" width={100} {...yAxisStyle} />
                  <Tooltip
                    formatter={(value: number) => [value, '交易次数']}
                    contentStyle={tooltipStyle.contentStyle}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="count" fill={expenseColorHex} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
        </ChartCard>
      </div>

      {/* Account Overview - Full Width, 2 Columns */}
      <ChartCard
        title="账户概览"
        description={groupBy === 'type' ? '各账户详细信息（按类型分组）' : '各账户详细信息（按前缀分组）'}
      >
          {/* Group By Toggle */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">分组方式:</span>
            <div className="flex gap-1">
              <Button
                variant={groupBy === 'type' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGroupBy('type')}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                按类型
              </Button>
              <Button
                variant={groupBy === 'prefix' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGroupBy('prefix')}
              >
                <Wallet className="h-4 w-4 mr-1" />
                按前缀
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {accountGroups.map((group, groupIndex) => {
              const typeConfig = group.accountType ? ACCOUNT_TYPE_CONFIG[group.accountType] : null;
              const TypeIcon = typeConfig?.icon;

              return (
                <div key={group.prefix} className="space-y-3">
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-2 pb-2 border-b">
                    <div className="flex items-center gap-2">
                      {typeConfig ? (
                        <>
                          <div className={`p-1.5 rounded ${typeConfig.color} text-white`}>
                            <TypeIcon className="h-3 w-3" />
                          </div>
                          <h3 className="text-lg font-semibold">{typeConfig.label}</h3>
                        </>
                      ) : (
                        <>
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colors[groupIndex % colors.length] }}
                          />
                          <h3 className="text-lg font-semibold">{group.prefix}</h3>
                        </>
                      )}
                      <Badge variant="outline">{group.accounts.length} 个账户</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">总收入: </span>
                        <span className={`font-medium ${incomeColorClass}`}>
                          {formatCurrencyFull(group.totalIncome)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">总支出: </span>
                        <span className={`font-medium ${expenseColorClass}`}>
                          {formatCurrencyFull(group.totalExpense)}
                        </span>
                      </div>
                      <Badge variant={group.totalBalance >= 0 ? 'default' : 'destructive'}>
                        {group.totalBalance >= 0 ? '+' : ''}{formatCurrencyFull(group.totalBalance)}
                      </Badge>
                    </div>
                  </div>

                  {/* Group Accounts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.accounts.map((acc, i) => (
                      <div key={acc.name} className="p-3 rounded-lg bg-muted/30 border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{acc.name}</span>
                          <Badge
                            variant={acc.balance >= 0 ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {acc.balance >= 0 ? '+' : ''}{formatCurrencyFull(acc.balance)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">收入</p>
                            <p className={`font-medium ${incomeColorClass}`}>
                              {formatCurrencyK(acc.income)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">支出</p>
                            <p className={`font-medium ${expenseColorClass}`}>
                              {formatCurrencyK(acc.expense)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">交易数</p>
                            <p className="font-medium">{acc.transactionCount}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
      </ChartCard>

      {/* Detailed Table */}
      <ChartCard
        title="账户明细表"
        description="完整的账户数据统计"
      >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账户</TableHead>
                <TableHead className="text-right">收入</TableHead>
                <TableHead className="text-right">支出</TableHead>
                <TableHead className="text-right">结余</TableHead>
                <TableHead className="text-right">交易数</TableHead>
                <TableHead className="text-right">占比</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountData.map(acc => (
                <TableRow key={acc.name}>
                  <TableCell className="font-medium">{acc.name}</TableCell>
                  <TableCell className={`text-right ${incomeColorClass}`}>
                    {formatCurrencyFull(acc.income)}
                  </TableCell>
                  <TableCell className={`text-right ${expenseColorClass}`}>
                    {formatCurrencyFull(acc.expense)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${acc.balance >= 0 ? incomeColorClass : expenseColorClass}`}>
                    {acc.balance >= 0 ? '+' : ''}{formatCurrencyFull(acc.balance)}
                  </TableCell>
                  <TableCell className="text-right">{acc.transactionCount}</TableCell>
                  <TableCell className="text-right">
                    {summaryStats.totalTransactions === 0
                      ? '0.0%'
                      : ((acc.transactionCount / summaryStats.totalTransactions) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </ChartCard>
    </div>
  );
}
