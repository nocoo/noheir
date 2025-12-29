import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { TrendingUp, Wallet, Calendar, ArrowUp, ArrowDown } from 'lucide-react';

interface IncomeAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
}

export function IncomeAnalysis({ transactions, monthlyData }: IncomeAnalysisProps) {
  const incomeTransactions = useMemo(() => 
    transactions.filter(t => t.type === 'income'),
    [transactions]
  );

  const totalIncome = useMemo(() => 
    incomeTransactions.reduce((sum, t) => sum + t.amount, 0),
    [incomeTransactions]
  );

  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, { total: number; secondary: Map<string, number> }>();
    
    incomeTransactions.forEach(t => {
      if (!categoryMap.has(t.primaryCategory)) {
        categoryMap.set(t.primaryCategory, { total: 0, secondary: new Map() });
      }
      const cat = categoryMap.get(t.primaryCategory)!;
      cat.total += t.amount;
      cat.secondary.set(t.secondaryCategory, (cat.secondary.get(t.secondaryCategory) || 0) + t.amount);
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      total: data.total,
      percentage: totalIncome > 0 ? (data.total / totalIncome) * 100 : 0,
      subcategories: Array.from(data.secondary.entries()).map(([name, total]) => ({
        name,
        total,
        percentage: totalIncome > 0 ? (total / totalIncome) * 100 : 0
      }))
    })).sort((a, b) => b.total - a.total);
  }, [incomeTransactions, totalIncome]);

  const accountData = useMemo(() => {
    const accountMap = new Map<string, number>();
    incomeTransactions.forEach(t => {
      accountMap.set(t.account, (accountMap.get(t.account) || 0) + t.amount);
    });
    return Array.from(accountMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [incomeTransactions]);

  const monthlyIncome = useMemo(() => 
    monthlyData.filter(d => d.income > 0),
    [monthlyData]
  );

  const avgMonthlyIncome = useMemo(() => 
    monthlyIncome.length > 0 
      ? monthlyIncome.reduce((s, d) => s + d.income, 0) / monthlyIncome.length 
      : 0,
    [monthlyIncome]
  );

  const incomeGrowth = useMemo(() => {
    const validMonths = monthlyData.filter(d => d.income > 0);
    if (validMonths.length < 2) return 0;
    const first = validMonths[0].income;
    const last = validMonths[validMonths.length - 1].income;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [monthlyData]);

  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  if (incomeTransactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>收入分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">暂无收入数据</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          title="总收入" 
          value={totalIncome} 
          icon={TrendingUp}
          variant="income"
        />
        <StatCard 
          title="月均收入" 
          value={Math.round(avgMonthlyIncome)} 
          icon={Calendar}
          variant="income"
        />
        <StatCard 
          title="收入笔数" 
          value={incomeTransactions.length}
          icon={Wallet}
        />
        <StatCard 
          title="收入增长" 
          value={`${incomeGrowth >= 0 ? '+' : ''}${incomeGrowth.toFixed(1)}%`}
          icon={incomeGrowth >= 0 ? ArrowUp : ArrowDown}
          variant={incomeGrowth >= 0 ? 'income' : 'expense'}
        />
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>月度收入趋势</CardTitle>
          <CardDescription>每月收入变化趋势</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '收入']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  fill="url(#incomeGradient)"
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
            <CardTitle>收入来源分布</CardTitle>
            <CardDescription>按类别分析收入来源</CardDescription>
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
            <CardTitle>收款账户分布</CardTitle>
            <CardDescription>各账户收入情况</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip 
                    formatter={(value: number) => [`¥${value.toLocaleString()}`, '收入']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Category List */}
      <Card>
        <CardHeader>
          <CardTitle>收入明细</CardTitle>
          <CardDescription>各类别收入详情</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryData.map((cat, i) => (
              <div key={cat.category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-sm" 
                      style={{ backgroundColor: colors[i % colors.length] }}
                    />
                    <span className="font-medium">{cat.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      ¥{cat.total.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                {cat.subcategories.length > 0 && (
                  <div className="ml-5 pl-3 border-l-2 border-border space-y-1">
                    {cat.subcategories.map(sub => (
                      <div key={sub.name} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{sub.name}</span>
                        <span>¥{sub.total.toLocaleString()}</span>
                      </div>
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
