import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Transaction, MonthlyData } from '@/types/transaction';
import { StatCard } from './StatCard';
import { useSettings, getIncomeColor, getIncomeColorHex } from '@/contexts/SettingsContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend, ReferenceLine
} from 'recharts';
import { TrendingUp, Wallet, Calendar, Trophy, Layers, CreditCard, FileText } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface IncomeAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
}

export function IncomeAnalysis({ transactions, monthlyData }: IncomeAnalysisProps) {
  const { settings } = useSettings();
  const incomeColorHex = getIncomeColorHex(settings.colorScheme);
  const incomeColorClass = getIncomeColor(settings.colorScheme);

  const incomeTransactions = useMemo(() =>
    transactions.filter(t => t.type === 'income'),
    [transactions]
  );

  const totalIncome = useMemo(() =>
    incomeTransactions.reduce((sum, t) => sum + t.amount, 0),
    [incomeTransactions]
  );

  // Prepare nested pie data for income source distribution
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

    const THRESHOLD = 5; // 5% threshold

    // Process all categories
    const processed = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      total: data.total,
      percentage: totalIncome > 0 ? (data.total / totalIncome) * 100 : 0,
      subcategories: Array.from(data.secondary.entries()).map(([name, total]) => ({
        name: name,
        total,
        percentage: totalIncome > 0 ? (total / totalIncome) * 100 : 0,
        parent: category
      }))
    })).sort((a, b) => b.total - a.total);

    // Group small primary categories into "其他"
    const majorCategories = processed.filter(c => c.percentage >= THRESHOLD);
    const smallCategories = processed.filter(c => c.percentage < THRESHOLD);

    const chartData = [...majorCategories];
    if (smallCategories.length > 0) {
      const othersTotal = smallCategories.reduce((sum, c) => sum + c.total, 0);
      chartData.push({
        category: '其他',
        total: othersTotal,
        percentage: totalIncome > 0 ? (othersTotal / totalIncome) * 100 : 0,
        subcategories: []
      });
    }

    // Flatten all subcategories for nested pie (outer ring)
    const allSubcategories = processed
      .flatMap(cat => cat.subcategories)
      .filter(sub => sub.percentage >= THRESHOLD)
      .sort((a, b) => b.total - a.total);

    // Group small subcategories
    const majorSubs = allSubcategories.filter(s => s.percentage >= THRESHOLD);
    const smallSubsTotal = allSubcategories
      .filter(s => s.percentage < THRESHOLD)
      .reduce((sum, s) => sum + s.total, 0);

    const outerPieData = [...majorSubs];
    if (smallSubsTotal > 0) {
      outerPieData.push({
        name: '其他',
        total: smallSubsTotal,
        percentage: totalIncome > 0 ? (smallSubsTotal / totalIncome) * 100 : 0,
        parent: ''
      });
    }

    return { chartData, outerPieData, detailList: processed };
  }, [incomeTransactions, totalIncome]);

  // Account data - top 5 + others
  const accountData = useMemo(() => {
    const accountMap = new Map<string, number>();
    incomeTransactions.forEach(t => {
      accountMap.set(t.account, (accountMap.get(t.account) || 0) + t.amount);
    });

    const sorted = Array.from(accountMap.entries())
      .map(([name, value]) => ({ name, value, percentage: totalIncome > 0 ? (value / totalIncome) * 100 : 0 }))
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
        percentage: totalIncome > 0 ? (othersTotal / totalIncome) * 100 : 0
      });
    }

    return result;
  }, [incomeTransactions, totalIncome]);

  // Top 50 income transactions
  const topIncomeTransactions = useMemo(() =>
    [...incomeTransactions]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 50),
    [incomeTransactions]
  );

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          variant="income"
        />
      </div>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            月度收入趋势
          </CardTitle>
          <CardDescription>每月收入变化趋势</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={incomeColorHex} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={incomeColorHex} stopOpacity={0}/>
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
                  formatter={(value: number) => [`¥${value.toLocaleString()}`, '收入']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                    fontSize: '12px'
                  }}
                />
                <ReferenceLine
                  y={avgMonthlyIncome}
                  stroke={incomeColorHex}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: `平均 ¥${(avgMonthlyIncome / 1000).toFixed(1)}k`, fill: incomeColorHex, fontSize: 11, position: 'right' }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke={incomeColorHex}
                  strokeWidth={2}
                  fill="url(#incomeGradient)"
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
              收入来源分布
            </CardTitle>
            <CardDescription>内圈：一级分类 | 外圈：二级分类</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  {/* Inner Pie - Primary Categories */}
                  <Pie
                    data={categoryData.chartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={1}
                    dataKey="total"
                    nameKey="category"
                    label={(entry: any) => entry.percentage >= 5 ? `${entry.category}` : ''}
                    labelLine={false}
                    labelStyle={{ fontSize: '10px', fontWeight: 500 }}
                  >
                    {categoryData.chartData.map((entry, index) => (
                      <Cell key={`inner-${entry.category}`} fill={colors[index % colors.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                    ))}
                  </Pie>

                  {/* Outer Pie - Secondary Categories */}
                  <Pie
                    data={categoryData.outerPieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={87}
                    outerRadius={110}
                    paddingAngle={0.5}
                    dataKey="total"
                    nameKey="name"
                    label={false}
                  >
                    {categoryData.outerPieData.map((entry, index) => {
                      // Find parent category color
                      const parentIndex = categoryData.chartData.findIndex(c => c.category === entry.parent);
                      const baseColor = parentIndex >= 0 ? colors[parentIndex % colors.length] : colors[4];
                      // Use lighter/darker variant for outer ring
                      return (
                        <Cell
                          key={`outer-${entry.name}`}
                          fill={baseColor}
                          fillOpacity={0.7}
                          stroke="hsl(var(--card))"
                          strokeWidth={1}
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
              收款账户分布
            </CardTitle>
            <CardDescription>Top 5 账户收入情况</CardDescription>
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
                      '收入'
                    ]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="value" fill={incomeColorHex} radius={[0, 4, 4, 0]} />
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
            收入明细
          </CardTitle>
          <CardDescription>各类别收入详情</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryData.detailList.map((cat, i) => (
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
                    <span className={`font-semibold ${incomeColorClass}`}>
                      ¥{cat.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        <span>¥{sub.total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top 50 Income Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            单次收入 Top 50
          </CardTitle>
          <CardDescription>最高的50笔收入记录</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">排名</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>一级分类</TableHead>
                <TableHead>二级分类</TableHead>
                <TableHead>账户</TableHead>
                <TableHead className="text-right">金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topIncomeTransactions.map((t, index) => (
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
                  <TableCell className="text-muted-foreground">{t.account}</TableCell>
                  <TableCell className={`text-right font-semibold ${incomeColorClass}`}>
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
