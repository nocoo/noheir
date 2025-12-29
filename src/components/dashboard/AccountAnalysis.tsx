import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction } from '@/types/transaction';
import { StatCard } from './StatCard';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Wallet, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

export function AccountAnalysis({ transactions }: AccountAnalysisProps) {
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

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>账户分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">暂无数据</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="账户数量" 
          value={accountData.length} 
          icon={Wallet}
        />
        <StatCard 
          title="总资金流动" 
          value={totalFlow} 
          icon={ArrowUpDown}
        />
        <StatCard 
          title="净流入" 
          value={accountData.reduce((s, a) => s + a.income, 0)} 
          icon={TrendingUp}
          variant="income"
        />
        <StatCard 
          title="净流出" 
          value={accountData.reduce((s, a) => s + a.expense, 0)} 
          icon={TrendingDown}
          variant="expense"
        />
      </div>

      {/* Account Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>账户收支对比</CardTitle>
          <CardDescription>各账户收入支出情况</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="收入" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="支出" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>交易量分布</CardTitle>
            <CardDescription>各账户交易活跃度</CardDescription>
          </CardHeader>
          <CardContent>
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
                    label={(entry: any) => `${entry.name} ${entry.percentage.toFixed(0)}%`}
                    labelLine={false}
                    labelStyle={{ fontSize: '11px', fontWeight: 500 }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, '金额']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={60}
                    iconType="circle"
                    formatter={(value, entry: any) => (
                      <span style={{ color: 'hsl(var(--foreground))', fontSize: '12px' }}>
                        {value} ({entry.payload.percentage.toFixed(1)}%)
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Account Summary Cards */}
        <Card>
          <CardHeader>
            <CardTitle>账户概览</CardTitle>
            <CardDescription>各账户详细信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {accountData.map((acc, i) => (
                <div key={acc.name} className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: colors[i % colors.length] }}
                      />
                      <span className="font-semibold">{acc.name}</span>
                    </div>
                    <Badge variant={acc.balance >= 0 ? 'default' : 'destructive'}>
                      {acc.balance >= 0 ? '+' : ''}¥{acc.balance.toLocaleString()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">收入</p>
                      <p className="font-medium text-green-600 dark:text-green-400">
                        ¥{acc.income.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">支出</p>
                      <p className="font-medium text-red-600 dark:text-red-400">
                        ¥{acc.expense.toLocaleString()}
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
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>账户明细表</CardTitle>
          <CardDescription>完整的账户数据统计</CardDescription>
        </CardHeader>
        <CardContent>
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
                  <TableCell className="text-right text-green-600 dark:text-green-400">
                    ¥{acc.income.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-red-600 dark:text-red-400">
                    ¥{acc.expense.toLocaleString()}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${acc.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {acc.balance >= 0 ? '+' : ''}¥{acc.balance.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">{acc.transactionCount}</TableCell>
                  <TableCell className="text-right">
                    {((acc.transactionCount / totalTransactions) * 100).toFixed(1)}%
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
