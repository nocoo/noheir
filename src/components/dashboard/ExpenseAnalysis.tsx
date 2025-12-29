import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend, Treemap
} from 'recharts';
import { TrendingDown, Wallet, Calendar, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ExpenseAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
}

export function ExpenseAnalysis({ transactions, monthlyData }: ExpenseAnalysisProps) {
  const expenseTransactions = useMemo(() => 
    transactions.filter(t => t.type === 'expense'),
    [transactions]
  );

  const totalExpense = useMemo(() => 
    expenseTransactions.reduce((sum, t) => sum + t.amount, 0),
    [expenseTransactions]
  );

  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, { total: number; secondary: Map<string, number> }>();
    
    expenseTransactions.forEach(t => {
      if (!categoryMap.has(t.primaryCategory)) {
        categoryMap.set(t.primaryCategory, { total: 0, secondary: new Map() });
      }
      const cat = categoryMap.get(t.primaryCategory)!;
      cat.total += t.amount;
      cat.secondary.set(t.secondaryCategory, (cat.secondary.get(t.secondaryCategory) || 0) + t.amount);
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      name: category,
      total: data.total,
      value: data.total,
      percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0,
      subcategories: Array.from(data.secondary.entries()).map(([name, total]) => ({
        name,
        total,
        value: total,
        percentage: totalExpense > 0 ? (total / totalExpense) * 100 : 0
      }))
    })).sort((a, b) => b.total - a.total);
  }, [expenseTransactions, totalExpense]);

  const accountData = useMemo(() => {
    const accountMap = new Map<string, number>();
    expenseTransactions.forEach(t => {
      accountMap.set(t.account, (accountMap.get(t.account) || 0) + t.amount);
    });
    return Array.from(accountMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions]);

  const monthlyExpense = useMemo(() => 
    monthlyData.filter(d => d.expense > 0),
    [monthlyData]
  );

  const avgMonthlyExpense = useMemo(() => 
    monthlyExpense.length > 0 
      ? monthlyExpense.reduce((s, d) => s + d.expense, 0) / monthlyExpense.length 
      : 0,
    [monthlyExpense]
  );

  const maxExpenseMonth = useMemo(() => {
    if (monthlyData.length === 0) return null;
    return monthlyData.reduce((max, d) => d.expense > max.expense ? d : max, monthlyData[0]);
  }, [monthlyData]);

  const expenseGrowth = useMemo(() => {
    const validMonths = monthlyData.filter(d => d.expense > 0);
    if (validMonths.length < 2) return 0;
    const first = validMonths[0].expense;
    const last = validMonths[validMonths.length - 1].expense;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [monthlyData]);

  // Treemap data for hierarchical view
  const treemapData = useMemo(() => {
    return categoryData.map((cat, i) => ({
      name: cat.category,
      value: cat.total,
      children: cat.subcategories.map(sub => ({
        name: sub.name,
        value: sub.total
      }))
    }));
  }, [categoryData]);

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  if (expenseTransactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>支出分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">暂无支出数据</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="总支出" 
          value={totalExpense} 
          icon={TrendingDown}
          variant="expense"
        />
        <StatCard 
          title="月均支出" 
          value={Math.round(avgMonthlyExpense)} 
          icon={Calendar}
          variant="expense"
        />
        <StatCard 
          title="支出笔数" 
          value={expenseTransactions.length}
          icon={Wallet}
        />
        <StatCard 
          title="支出变化" 
          value={`${expenseGrowth >= 0 ? '+' : ''}${expenseGrowth.toFixed(1)}%`}
          icon={expenseGrowth >= 0 ? ArrowUp : ArrowDown}
          variant={expenseGrowth >= 0 ? 'expense' : 'income'}
        />
      </div>

      {/* Warning for high expense month */}
      {maxExpenseMonth && maxExpenseMonth.expense > avgMonthlyExpense * 1.5 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  高支出提醒
                </p>
                <p className="text-sm text-muted-foreground">
                  {maxExpenseMonth.month}支出 ¥{maxExpenseMonth.expense.toLocaleString()}，
                  超出月均 {((maxExpenseMonth.expense / avgMonthlyExpense - 1) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>月度支出趋势</CardTitle>
          <CardDescription>每月支出变化趋势</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '支出']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="expense" 
                  stroke="hsl(0, 84%, 60%)" 
                  strokeWidth={2}
                  fill="url(#expenseGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>支出类别分布</CardTitle>
            <CardDescription>按类别分析支出结构</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="total"
                    nameKey="category"
                    label={({ category, percentage }) => `${category} ${percentage.toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={entry.category} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, '金额']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Account Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>支付账户分布</CardTitle>
            <CardDescription>各账户支出情况</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip 
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, '支出']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(0, 84%, 60%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Spending Categories */}
      <Card>
        <CardHeader>
          <CardTitle>支出排行</CardTitle>
          <CardDescription>按金额排序的支出类别</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryData.slice(0, 5).map((cat, i) => (
              <div key={cat.category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 rounded-full p-0 justify-center">
                      {i + 1}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ backgroundColor: colors[i % colors.length] }}
                      />
                      <span className="font-medium">{cat.category}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ¥{cat.total.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all"
                    style={{ 
                      width: `${cat.percentage}%`,
                      backgroundColor: colors[i % colors.length]
                    }}
                  />
                </div>
                {cat.subcategories.length > 0 && (
                  <div className="ml-9 flex flex-wrap gap-2">
                    {cat.subcategories.slice(0, 5).map(sub => (
                      <Badge key={sub.name} variant="secondary" className="text-xs">
                        {sub.name}: ¥{sub.total.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
