import { useMemo, useState } from 'react';
import { Transaction } from '@/types/transaction';
import { StatCard } from './StatCard';
import { useSettings, getIncomeColor, getIncomeColorHex, getExpenseColor, getExpenseColorHex, AccountType, getAccountType, ACCOUNT_TYPE_CONFIG } from '@/contexts/SettingsContext';
import type { PieLabelEntry, LegendPayloadEntry } from '@/types/category-shared';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
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

interface AccountSummary {
  name: string;
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
  categories: Map<string, number>;
}

interface AccountGroup {
  prefix: string;
  accounts: AccountSummary[];
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  totalTransactions: number;
  accountType?: AccountType;
}

type GroupByType = 'prefix' | 'type';

// Helper function to extract account prefix (part before hyphen)
function getAccountPrefix(accountName: string): string {
  const hyphenIndex = accountName.indexOf('-');
  if (hyphenIndex > 0) {
    return accountName.substring(0, hyphenIndex).trim();
  }
  return accountName;
}

export function AccountAnalysis({ transactions }: AccountAnalysisProps) {
  const { settings } = useSettings();
  const [groupBy, setGroupBy] = useState<GroupByType>('type'); // 默认按类型分组
  const incomeColorClass = getIncomeColor(settings.colorScheme);
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);

  const accountData = useMemo(() => {
    const accountMap = new Map<string, AccountSummary>();
    
    transactions.forEach(t => {
      if (!accountMap.has(t.account)) {
        accountMap.set(t.account, {
          name: t.account,
          income: 0,
          expense: 0,
          balance: 0,
          transactionCount: 0,
          categories: new Map()
        });
      }
      const account = accountMap.get(t.account)!;
      account.transactionCount++;
      
      if (t.type === 'income') {
        account.income += t.amount;
      } else {
        account.expense += t.amount;
      }
      account.balance = account.income - account.expense;
      
      const catKey = `${t.type}-${t.primaryCategory}`;
      account.categories.set(catKey, (account.categories.get(catKey) || 0) + t.amount);
    });

    return Array.from(accountMap.values()).sort((a, b) => 
      (b.income + b.expense) - (a.income + a.expense)
    );
  }, [transactions]);

  // Group accounts by prefix or type
  const accountGroups = useMemo(() => {
    const groupMap = new Map<string, AccountGroup>();

    accountData.forEach(acc => {
      const groupKey = groupBy === 'type'
        ? (settings.accountTypes?.find(c => c.accountName === acc.name)?.type || 'unclassified')
        : getAccountPrefix(acc.name);

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          prefix: groupKey,
          accounts: [],
          totalIncome: 0,
          totalExpense: 0,
          totalBalance: 0,
          totalTransactions: 0,
          accountType: groupBy === 'type' ? groupKey as AccountType : undefined,
        });
      }

      const group = groupMap.get(groupKey)!;
      group.accounts.push(acc);
      group.totalIncome += acc.income;
      group.totalExpense += acc.expense;
      group.totalBalance += acc.balance;
      group.totalTransactions += acc.transactionCount;
    });

    // Sort groups by total transaction volume
    return Array.from(groupMap.values()).sort((a, b) =>
      (b.totalIncome + b.totalExpense) - (a.totalIncome + a.totalExpense)
    );
  }, [accountData, groupBy, settings.accountTypes]);

  const chartData = useMemo(() => 
    accountData.map(acc => ({
      name: acc.name,
      收入: acc.income,
      支出: acc.expense,
      结余: acc.balance
    })),
    [accountData]
  );

  const pieData = useMemo(() => {
    const total = accountData.reduce((sum, acc) => sum + acc.income + acc.expense, 0);
    const THRESHOLD = 5; // 5% threshold

    // Group small accounts into "其他"
    const major = accountData.filter(acc => {
      const value = acc.income + acc.expense;
      return (value / total) * 100 >= THRESHOLD;
    });

    const othersTotal = accountData
      .filter(acc => {
        const value = acc.income + acc.expense;
        return (value / total) * 100 < THRESHOLD;
      })
      .reduce((sum, acc) => sum + acc.income + acc.expense, 0);

    const result = major.map(acc => ({
      name: acc.name,
      value: acc.income + acc.expense,
      percentage: ((acc.income + acc.expense) / total) * 100,
    }));

    if (othersTotal > 0) {
      result.push({
        name: '其他',
        value: othersTotal,
        percentage: (othersTotal / total) * 100,
      });
    }

    return result;
  }, [accountData]);

  const monthlyByAccount = useMemo(() => {
    const monthMap = new Map<string, Map<string, { income: number; expense: number }>>();
    
    transactions.forEach(t => {
      const monthKey = `${t.month}月`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, new Map());
      }
      const accountData = monthMap.get(monthKey)!;
      if (!accountData.has(t.account)) {
        accountData.set(t.account, { income: 0, expense: 0 });
      }
      const data = accountData.get(t.account)!;
      if (t.type === 'income') {
        data.income += t.amount;
      } else {
        data.expense += t.amount;
      }
    });

    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    const accounts = [...new Set(transactions.map(t => t.account))];
    
    return months.map((month, i): Record<string, string | number> => {
      const monthData = monthMap.get(`${i + 1}月`) || new Map();
      const result: Record<string, string | number> = { month };
      accounts.forEach(acc => {
        const data = monthData.get(acc) || { income: 0, expense: 0 };
        result[`${acc}_income`] = data.income;
        result[`${acc}_expense`] = data.expense;
      });
      return result;
    });
  }, [transactions]);

  const accounts = [...new Set(transactions.map(t => t.account))];
  const totalTransactions = transactions.length;
  const totalFlow = transactions.reduce((s, t) => s + t.amount, 0);

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  // Top 20 accounts by transaction count
  const topTransactionCounts = useMemo(() => {
    return accountData
      .map(acc => ({
        name: acc.name,
        count: acc.transactionCount
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [accountData]);

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
            value={accountData.length}
            icon={Wallet}
            showCurrency={false}
          />
        </motion.div>
        <motion.div variants={gridItem}>
          <StatCard
            title="总资金流动"
            value={totalFlow}
            icon={ArrowUpDown}
          />
        </motion.div>
        <motion.div variants={gridItem}>
          <StatCard
            title="净流入"
            value={accountData.reduce((s, a) => s + a.income, 0)}
            icon={TrendingUp}
            variant="income"
          />
        </motion.div>
        <motion.div variants={gridItem}>
          <StatCard
            title="净流出"
            value={accountData.reduce((s, a) => s + a.expense, 0)}
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
                    labelStyle={{ fontSize: '11px', fontWeight: 500 }}
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
                    formatter={(value, entry: LegendPayloadEntry) => (
                      <span style={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}>
                        {value} ({entry.payload.percentage.toFixed(1)}%)
                      </span>
                    )}
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
                    {((acc.transactionCount / totalTransactions) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </ChartCard>
    </div>
  );
}
