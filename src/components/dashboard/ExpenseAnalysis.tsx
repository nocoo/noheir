import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { useSettings, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend, ReferenceLine
} from 'recharts';
import { TrendingDown, Wallet, Calendar, Layers, CreditCard, FileText, Trophy, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface ExpenseAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
}

export function ExpenseAnalysis({ transactions, monthlyData }: ExpenseAnalysisProps) {
  const { settings } = useSettings();
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);

  // Collapsed state for tertiary categories
  const [collapsedTertiary, setCollapsedTertiary] = useState<Set<string>>(new Set());

  const toggleTertiary = (key: string) => {
    setCollapsedTertiary(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expenseTransactions = useMemo(() =>
    transactions.filter(t => t.type === 'expense'),
    [transactions]
  );

  const totalExpense = useMemo(() => 
    expenseTransactions.reduce((sum, t) => sum + t.amount, 0),
    [expenseTransactions]
  );

  const categoryData = useMemo(() => {
    // Primary -> Secondary -> Tertiary hierarchy
    const primaryMap = new Map<string, {
      total: number;
      secondaryMap: Map<string, {
        total: number;
        tertiaryList: Array<{ name: string; total: number; percentage: number }>;
      }>;
    }>();

    expenseTransactions.forEach(t => {
      if (!primaryMap.has(t.primaryCategory)) {
        primaryMap.set(t.primaryCategory, { total: 0, secondaryMap: new Map() });
      }
      const primary = primaryMap.get(t.primaryCategory)!;
      primary.total += t.amount;

      if (!primary.secondaryMap.has(t.secondaryCategory)) {
        primary.secondaryMap.set(t.secondaryCategory, { total: 0, tertiaryList: [] });
      }
      const secondary = primary.secondaryMap.get(t.secondaryCategory)!;
      secondary.total += t.amount;
    });

    // Calculate tertiary percentages and group transactions
    expenseTransactions.forEach(t => {
      const primary = primaryMap.get(t.primaryCategory);
      if (primary) {
        const secondary = primary.secondaryMap.get(t.secondaryCategory);
        if (secondary) {
          // Find or create tertiary group
          let tertiaryGroup = secondary.tertiaryList.find(grp => grp.name === t.tertiaryCategory);
          if (!tertiaryGroup) {
            tertiaryGroup = {
              name: t.tertiaryCategory,
              total: 0,
              percentage: 0,
              transactions: []
            };
            secondary.tertiaryList.push(tertiaryGroup);
          }
          tertiaryGroup.total += t.amount;
          tertiaryGroup.transactions.push({
            date: t.date,
            amount: t.amount
          });
        }
      }
    });

    const THRESHOLD = 5; // 5% threshold

    // Process primary categories for inner pie
    const processedPrimary = Array.from(primaryMap.entries()).map(([primary, data]) => ({
      primary,
      total: data.total,
      percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0,
      secondaryCategories: Array.from(data.secondaryMap.entries()).map(([secondary, secData]) => ({
        name: secondary,
        total: secData.total,
        percentage: totalExpense > 0 ? (secData.total / totalExpense) * 100 : 0,
        parent: primary,
        tertiaryList: secData.tertiaryList.sort((a, b) => b.total - a.total)
      }))
    })).sort((a, b) => b.total - a.total);

    // Calculate percentages after grouping
    processedPrimary.forEach(primary => {
      primary.secondaryCategories.forEach(secondary => {
        secondary.tertiaryList.forEach(tertiary => {
          tertiary.percentage = totalExpense > 0 ? (tertiary.total / totalExpense) * 100 : 0;
          // Sort transactions by date (newest first)
          if (tertiary.transactions) {
            tertiary.transactions.sort((a, b) => b.date.localeCompare(a.date));
          }
        });
      });
    });

    // Group small primary categories into "其他"
    const majorPrimaries = processedPrimary.filter(c => c.percentage >= THRESHOLD);
    const smallPrimaries = processedPrimary.filter(c => c.percentage < THRESHOLD);

    const chartData = [...majorPrimaries];
    if (smallPrimaries.length > 0) {
      const othersTotal = smallPrimaries.reduce((sum, c) => sum + c.total, 0);
      chartData.push({
        primary: '其他',
        total: othersTotal,
        percentage: totalExpense > 0 ? (othersTotal / totalExpense) * 100 : 0,
        secondaryCategories: []
      });
    }

    // Flatten all secondary categories for outer pie
    const allSecondaries = processedPrimary
      .flatMap(p => p.secondaryCategories)
      .filter(s => s.percentage >= THRESHOLD)
      .sort((a, b) => b.total - a.total);

    const majorSecondaries = allSecondaries.filter(s => s.percentage >= THRESHOLD);
    const smallSecondariesTotal = allSecondaries
      .filter(s => s.percentage < THRESHOLD)
      .reduce((sum, s) => sum + s.total, 0);

    const outerPieData = [...majorSecondaries];
    if (smallSecondariesTotal > 0) {
      outerPieData.push({
        name: '其他',
        total: smallSecondariesTotal,
        percentage: totalExpense > 0 ? (smallSecondariesTotal / totalExpense) * 100 : 0,
        parent: ''
      });
    }

    return { chartData, outerPieData, detailList: processedPrimary };
  }, [expenseTransactions, totalExpense]);

  // Account data - top 5 + others
  const accountData = useMemo(() => {
    const accountMap = new Map<string, number>();
    expenseTransactions.forEach(t => {
      accountMap.set(t.account, (accountMap.get(t.account) || 0) + t.amount);
    });

    const sorted = Array.from(accountMap.entries())
      .map(([name, value]) => ({ name, value, percentage: totalExpense > 0 ? (value / totalExpense) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    // Take top 5
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);

    const result = [...top5];
    if (others.length > 0) {
      const othersTotal = others.reduce((sum, acc) => sum + acc.value, 0);
      result.push({
        name: '其他',
        value: othersTotal,
        percentage: totalExpense > 0 ? (othersTotal / totalExpense) * 100 : 0
      });
    }

    return result;
  }, [expenseTransactions, totalExpense]);

  // Top 50 expense transactions
  const topExpenseTransactions = useMemo(() =>
    [...expenseTransactions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50),
    [expenseTransactions]
  );

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          variant="expense"
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
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            月度支出趋势
          </CardTitle>
          <CardDescription>每月支出变化趋势</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={expenseColorHex} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={expenseColorHex} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '支出']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                    fontSize: '12px'
                  }}
                />
                <ReferenceLine
                  y={avgMonthlyExpense}
                  stroke={expenseColorHex}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: `平均 ¥${(avgMonthlyExpense / 1000).toFixed(1)}k`, fill: expenseColorHex, fontSize: 11, position: 'right' }}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke={expenseColorHex}
                  strokeWidth={2}
                  fill="url(#expenseGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown - Nested Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              支出类别分布
            </CardTitle>
            <CardDescription>内圈：一级分类 | 中圈：二级分类 | 外圈：三级分类</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  {/* Inner Pie - Primary Categories (一级) */}
                  <Pie
                    data={categoryData.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={45}
                    paddingAngle={1}
                    dataKey="total"
                    nameKey="primary"
                    label={(entry: any) => entry.percentage >= 8 ? `${entry.primary}` : ''}
                    labelLine={false}
                    labelStyle={{ fontSize: '10px', fontWeight: 500 }}
                  >
                    {categoryData.chartData.map((entry, index) => (
                      <Cell key={`inner-${entry.primary}`} fill={colors[index % colors.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                    ))}
                  </Pie>

                  {/* Middle Pie - Secondary Categories (二级) */}
                  <Pie
                    data={categoryData.outerPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={47}
                    outerRadius={75}
                    paddingAngle={0.5}
                    dataKey="total"
                    nameKey="name"
                    label={false}
                  >
                    {categoryData.outerPieData.map((entry, index) => {
                      // Find parent category color
                      const parentIndex = categoryData.chartData.findIndex(c => c.primary === entry.parent);
                      const baseColor = parentIndex >= 0 ? colors[parentIndex % colors.length] : colors[4];
                      // Use lighter variant for middle ring
                      return (
                        <Cell
                          key={`middle-${entry.name}`}
                          fill={baseColor}
                          fillOpacity={0.75}
                          stroke="hsl(var(--card))"
                          strokeWidth={1}
                        />
                      );
                    })}
                  </Pie>

                  {/* Outer Pie - Tertiary Categories (三级) */}
                  <Pie
                    data={categoryData.detailList.flatMap(p => p.secondaryCategories).flatMap(s => s.tertiaryList.map(t => ({ ...t, parent: s.parent })))}
                    cx="50%"
                    cy="50%"
                    innerRadius={77}
                    outerRadius={105}
                    paddingAngle={0.3}
                    dataKey="total"
                    nameKey="name"
                    label={false}
                  >
                    {(categoryData.detailList.flatMap(p => p.secondaryCategories).flatMap(s => s.tertiaryList.map(t => ({ ...t, parent: s.parent })))).map((entry, index) => {
                      // Find parent category color
                      const parentIndex = categoryData.chartData.findIndex(c => c.primary === entry.parent);
                      const baseColor = parentIndex >= 0 ? colors[parentIndex % colors.length] : colors[4];
                      // Use lighter variant for outer ring
                      return (
                        <Cell
                          key={`outer-${entry.name}-${entry.parent}`}
                          fill={baseColor}
                          fillOpacity={0.5}
                          stroke="hsl(var(--card))"
                          strokeWidth={0.5}
                        />
                      );
                    })}
                  </Pie>

                  <Tooltip
                    formatter={(value: number, name: string) => [`¥${value.toLocaleString()}`, name]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={50}
                    iconType="circle"
                    formatter={(value: string) => (
                      <span style={{ color: 'hsl(var(--foreground))', fontSize: '11px' }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Account Distribution - Top 5 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              支付账户分布
            </CardTitle>
            <CardDescription>Top 5 账户支出情况</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                    tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 10 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `¥${value.toLocaleString()} (${props.payload.percentage.toFixed(1)}%)`,
                      '支出'
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="value" fill={expenseColorHex} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Category List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            支出明细
          </CardTitle>
          <CardDescription>各类别支出详情</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryData.detailList.map((cat, i) => (
              <div key={cat.primary} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: colors[i % colors.length] }}
                    />
                    <span className="font-medium">{cat.primary}</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-semibold ${expenseColorClass}`}>
                      ¥{cat.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                {cat.secondaryCategories.length > 0 && (
                  <div className="ml-5 pl-3 border-l-2 border-border space-y-2">
                    {cat.secondaryCategories.map(sub => (
                      <div key={sub.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground font-medium">{sub.name}</span>
                          <span className="text-sm">¥{sub.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {sub.tertiaryList.length > 0 && (
                          <div className="ml-4 space-y-1">
                            {sub.tertiaryList.map(tertiary => {
                              const tertiaryKey = `${cat.primary}-${sub.name}-${tertiary.name}`;
                              const isCollapsed = collapsedTertiary.has(tertiaryKey);
                              return (
                                <div key={tertiary.name} className="space-y-0.5">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{tertiary.name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs">¥{tertiary.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0"
                                        onClick={() => toggleTertiary(tertiaryKey)}
                                      >
                                        {isCollapsed ? (
                                          <ChevronRight className="h-3 w-3" />
                                        ) : (
                                          <ChevronDown className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                  {!isCollapsed && tertiary.transactions && tertiary.transactions.map((tx, idx) => (
                                    <div key={idx} className="flex justify-between text-xs text-muted-foreground ml-4">
                                      <span>{tx.date}</span>
                                      <span>¥{tx.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top 50 Expense Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            单次支出 Top 50
          </CardTitle>
          <CardDescription>最高的50笔支出记录</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">排名</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>一级分类</TableHead>
                <TableHead>二级分类</TableHead>
                <TableHead>三级分类</TableHead>
                <TableHead>账户</TableHead>
                <TableHead className="text-right">金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topExpenseTransactions.map((t, index) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {index < 3 && (
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {index + 1}
                      </span>
                    )}
                    {index >= 3 && <span className="text-muted-foreground">#{index + 1}</span>}
                  </TableCell>
                  <TableCell className="text-sm">{t.date}</TableCell>
                  <TableCell>{t.primaryCategory}</TableCell>
                  <TableCell className="text-muted-foreground">{t.secondaryCategory}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{t.tertiaryCategory}</TableCell>
                  <TableCell className="text-muted-foreground">{t.account}</TableCell>
                  <TableCell className={`text-right font-semibold ${expenseColorClass}`}>
                    ¥{t.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
