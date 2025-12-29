import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { useSettings, getExpenseColor, getExpenseColorHex } from '@/contexts/SettingsContext';
import { getSecondaryCategoryColor } from '@/types/category';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend, ReferenceLine
} from 'recharts';
import { TrendingDown, Wallet, Calendar, Layers, CreditCard, FileText, Trophy, ChevronDown, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { tooltipStyle, xAxisStyle, yAxisStyle, gridStyle, legendStyle, formatCurrencyK } from '@/lib/chart-config';

interface ExpenseAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
}

export function ExpenseAnalysis({ transactions, monthlyData }: ExpenseAnalysisProps) {
  const { settings } = useSettings();
  const expenseColorHex = getExpenseColorHex(settings.colorScheme);
  const expenseColorClass = getExpenseColor(settings.colorScheme);

  // Collapsed state for secondary and tertiary categories - default all collapsed
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Initialize with all categories collapsed
  useEffect(() => {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const allKeys = new Set<string>();

    expenseTransactions.forEach(t => {
      allKeys.add(`${t.primaryCategory}-${t.secondaryCategory}`);
      allKeys.add(`${t.primaryCategory}-${t.secondaryCategory}-${t.tertiaryCategory}`);
    });

    setCollapsed(allKeys);
  }, [transactions]);

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Category filter state for bar chart
  const [selectedPrimary, setSelectedPrimary] = useState<string>('all');

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
      secondaryCategories: Array.from(data.secondaryMap.entries())
        .map(([secondary, secData]) => ({
          name: secondary,
          total: secData.total,
          percentage: totalExpense > 0 ? (secData.total / totalExpense) * 100 : 0,
          parent: primary,
          tertiaryList: secData.tertiaryList.sort((a, b) => b.total - a.total)
        }))
        .sort((a, b) => b.total - a.total) // Sort secondary by amount
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

  // Account data - top 20 accounts
  const accountData = useMemo(() => {
    const accountMap = new Map<string, number>();
    expenseTransactions.forEach(t => {
      accountMap.set(t.account, (accountMap.get(t.account) || 0) + t.amount);
    });

    const sorted = Array.from(accountMap.entries())
      .map(([name, value]) => ({ name, value, percentage: totalExpense > 0 ? (value / totalExpense) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    // Take top 20
    return sorted.slice(0, 20);
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
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '支出']}
                  contentStyle={tooltipStyle.contentStyle}
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

      {/* Category Breakdown - Horizontal Bar Chart with Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                支出类别分布
              </CardTitle>
              <CardDescription>横向条形图，配合筛选器查看不同层级</CardDescription>
            </div>
            <Select value={selectedPrimary} onValueChange={setSelectedPrimary}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="选择层级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">按一级分类</SelectItem>
                {categoryData.detailList.map(cat => (
                  <SelectItem key={cat.primary} value={cat.primary}>
                    {cat.primary}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={selectedPrimary === 'all'
                  ? categoryData.detailList.map(c => ({ name: c.primary, value: c.total }))
                  : categoryData.detailList.find(p => p.primary === selectedPrimary)?.secondaryCategories.map(s => ({ name: s.name, value: s.total })) || []
                }
                layout="vertical"
                margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
              >
                <CartesianGrid {...gridStyle} />
                <XAxis type="number" tickFormatter={formatCurrencyK} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => `¥${value.toLocaleString()}`}
                  contentStyle={tooltipStyle.contentStyle}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {categoryData.detailList.map((cat, index) => (
                    <Cell key={`bar-${cat.primary}`} fill={selectedPrimary === 'all' ? colors[index % colors.length] : getSecondaryCategoryColor(categoryData.detailList.find(p => p.primary === selectedPrimary)?.secondaryCategories[index]?.name || '')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Account Distribution - Top 20 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            支付账户分布
          </CardTitle>
          <CardDescription>Top 20 账户支出情况</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={accountData} layout="horizontal" margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid {...gridStyle} />
                <XAxis
                  dataKey="name"
                  {...xAxisStyle}
                />
                <YAxis
                  width={100}
                  {...yAxisStyle}
                  tickFormatter={formatCurrencyK}
                />
                <Tooltip
                  formatter={(value: number) => `¥${value.toLocaleString()}`}
                  labelFormatter={(label) => label}
                  contentStyle={tooltipStyle.contentStyle}
                />
                <Bar dataKey="value" fill={expenseColorHex} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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
            {categoryData.detailList.map((cat, i) => {
              const primaryColor = colors[i % colors.length];
              return (
                <div key={cat.primary} className="rounded-lg overflow-hidden">
                  {/* Primary Category Row */}
                  <div className="flex items-center gap-3 py-2 px-3 bg-muted/20">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className="font-medium flex-1">{cat.primary}</span>
                    {/* Progress Bar */}
                    <div className="w-32 flex-shrink-0">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: primaryColor
                          }}
                        />
                      </div>
                    </div>
                    <span className={`font-semibold text-right w-28 flex-shrink-0 ${expenseColorClass}`}>
                      ¥{cat.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Secondary Categories */}
                  {cat.secondaryCategories.length > 0 && (
                    <div className="ml-6 space-y-1">
                      {cat.secondaryCategories.map(sub => {
                        const secondaryKey = `${cat.primary}-${sub.name}`;
                        const subColor = getSecondaryCategoryColor(sub.name);
                        const isSubCollapsed = collapsed.has(secondaryKey);
                        const subPercentage = cat.total > 0 ? (sub.total / cat.total) * 100 : 0;

                        return (
                          <div key={sub.name} className="rounded-lg overflow-hidden">
                            {/* Secondary Category Row - Clickable */}
                            <button
                              onClick={() => toggleCollapse(secondaryKey)}
                              className="w-full flex items-center gap-3 py-2 px-3 hover:bg-muted/30 transition-colors text-left"
                            >
                              <div className="flex-shrink-0">
                                {isSubCollapsed ? (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <span className="text-sm text-muted-foreground font-medium flex-1">{sub.name}</span>
                              {/* Progress Bar */}
                              <div className="w-32 flex-shrink-0">
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${subPercentage}%`,
                                      backgroundColor: subColor
                                    }}
                                  />
                                </div>
                              </div>
                              <span className="text-sm text-right w-28 flex-shrink-0">¥{sub.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </button>

                            {/* Tertiary Categories & Transactions */}
                            {!isSubCollapsed && sub.tertiaryList.length > 0 && (
                              <div className="ml-8 space-y-1 mt-1">
                                {sub.tertiaryList.map(tertiary => {
                                  const tertiaryKey = `${cat.primary}-${sub.name}-${tertiary.name}`;
                                  const isTertiaryCollapsed = collapsed.has(tertiaryKey);
                                  const tertiaryPercentage = sub.total > 0 ? (tertiary.total / sub.total) * 100 : 0;

                                  return (
                                    <div key={tertiary.name} className="rounded-lg overflow-hidden">
                                      {/* Tertiary Category Row - Clickable */}
                                      <button
                                        onClick={() => toggleCollapse(tertiaryKey)}
                                        className="w-full flex items-center gap-3 py-1.5 px-3 hover:bg-muted/20 transition-colors text-left"
                                      >
                                        <div className="flex-shrink-0">
                                          {isTertiaryCollapsed ? (
                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                          ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                          )}
                                        </div>
                                        <span className="text-xs text-muted-foreground flex-1">{tertiary.name}</span>
                                        {/* Progress Bar */}
                                        <div className="w-32 flex-shrink-0">
                                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all"
                                              style={{
                                                width: `${tertiaryPercentage}%`,
                                                backgroundColor: subColor,
                                                opacity: 0.8
                                              }}
                                            />
                                          </div>
                                        </div>
                                        <span className="text-xs text-right w-28 flex-shrink-0">¥{tertiary.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </button>

                                      {/* Transactions */}
                                      {!isTertiaryCollapsed && tertiary.transactions && tertiary.transactions.map((tx, idx) => {
                                        const txPercentage = tertiary.total > 0 ? (tx.amount / tertiary.total) * 100 : 0;
                                        return (
                                          <div key={idx} className="ml-7 flex items-center gap-3 py-1 px-3 hover:bg-muted/10 rounded transition-colors w-full">
                                            <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{tx.date}</span>
                                            {/* Progress Bar */}
                                            <div className="w-32 flex-shrink-0">
                                              <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                <div
                                                  className="h-full rounded-full transition-all"
                                                  style={{
                                                    width: `${txPercentage}%`,
                                                    backgroundColor: subColor,
                                                    opacity: 0.6
                                                  }}
                                                />
                                              </div>
                                            </div>
                                            <span className="text-xs text-right w-28 flex-shrink-0">¥{tx.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
                <TableHead>备注</TableHead>
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
                  <TableCell className="text-muted-foreground">{t.tertiaryCategory}</TableCell>
                  <TableCell className="text-muted-foreground">{t.account}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{t.description || '-'}</TableCell>
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
