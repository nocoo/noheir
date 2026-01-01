# 代码重构机会分析报告

> 生成时间: 2025-01-01
> 分析范围: `src/components/dashboard`, `src/components/assets`
> 目标: 识别可提取的公共组件和重复代码

---

## 📋 执行摘要

| 优先级 | 优化项 | 涉及文件 | 状态 | 预估减少代码 |
|--------|--------|---------|------|-------------|
| 🔴 高 | Income/Expense Analysis 合并 | 2 | ✅ 已完成 | ~150 行 |
| 🔴 高 | Income/Expense Heatmap 合并 | 2 | ✅ 已完成 | ~200 行 |
| 🔴 高 | CapitalDashboard PieChart 提取 | 1 (4组件) | ✅ 已完成 | ~200 行 |
| 🟡 中 | 颜色映射常量提取 | 多处 | ✅ 已完成 | ~50 行 |
| 🟡 中 | Tooltip 格式化提取 | 多处 | 🔄 进行中 | ~100 行 |
| 🟡 中 | ChartCard 组件提取 | 多处 | ⏸️ 待执行 | ~150 行 |
| 🟡 中 | 筛选排序 Hook 提取 | 2 | ⏸️ 待执行 | ~80 行 |
| 🟢 低 | 布局组件提取 | 多处 | ⏸️ 待执行 | ~100 行 |

**已完成**: ~600 行代码 (4个任务)
**总计**: 可减少约 **1000-1500 行代码** (10-15%)

---

## 🎯 执行记录

### 高优先级任务完成情况 (2025-01-01)

#### ✅ Task 1: 合并 IncomeHeatmap 和 ExpenseHeatmap
- **创建文件**: `src/components/dashboard/TransactionHeatmap.tsx`
- **更新文件**: `src/pages/Index.tsx`
- **删除文件**: `src/components/dashboard/IncomeHeatmap.tsx`, `src/components/dashboard/ExpenseHeatmap.tsx`
- **修复**: 颜色一致性问题（热力图点、图标、tooltip、统计文字统一）
- **收益**: 减少 ~200 行代码

#### ✅ Task 2: 合并 IncomeAnalysis 和 ExpenseAnalysis
- **创建文件**: `src/components/dashboard/TransactionAnalysis.tsx`
- **更新文件**: `src/pages/Index.tsx`
- **删除文件**: `src/components/dashboard/IncomeAnalysis.tsx`, `src/components/dashboard/ExpenseAnalysis.tsx`
- **修复**: 账户分布统一调整为 Top 10
- **收益**: 减少 ~150 行代码

#### ✅ Task 3: 提取 CapitalDashboard 的 PieChart
- **创建文件**: `src/components/assets/DistributionPieChart.tsx`
- **更新文件**: `src/components/assets/CapitalDashboard.tsx`
- **修复**: 饼图布局改为垂直（legend在底部，2列网格）
- **收益**: 减少 ~200 行代码

#### ✅ Task 4: 统一色板系统
- **创建文件**: `src/lib/colorPalette.ts`
- **更新文件**:
  - `src/components/assets/CapitalDashboard.tsx`
  - `src/components/charts/RigiditySankey.tsx`
  - `src/components/dashboard/TransactionHeatmap.tsx`
- **内容**:
  - UNIFIED_PALETTE: 18色基础色板（Tailwind 500 shades）
  - HEATMAP_GREEN_PALETTE/RED_PALETTE: GitHub-style gradients
  - RICH_PALETTE: 富色板（用于复杂可视化）
  - 策略/币种/状态/到期颜色常量
- **收益**: 统一管理，易于维护，减少 ~50 行代码

---

## 🔴 高优先级 - 几乎完全复制的组件

### 1. IncomeAnalysis vs ExpenseAnalysis

**重复度**: 95%+ 相似

| 文件 | 路径 | 行数 |
|------|------|------|
| IncomeAnalysis.tsx | `src/components/dashboard/IncomeAnalysis.tsx` | 147 |
| ExpenseAnalysis.tsx | `src/components/dashboard/ExpenseAnalysis.tsx` | 147 |

#### 差异点分析

```tsx
// ========== 差异点 1: 颜色获取 (第16行) ==========
// IncomeAnalysis.tsx:16
const incomeColorHex = getIncomeColorHex(settings.colorScheme);
const incomeColorClass = getIncomeColor(settings.colorScheme);

// ExpenseAnalysis.tsx:16
const expenseColorHex = getExpenseColorHex(settings.colorScheme);
const expenseColorClass = getExpenseColor(settings.colorScheme);

// ========== 差异点 2: 数据过滤 (第19-22行) ==========
// IncomeAnalysis.tsx:19-22
const incomeTransactions = useMemo(() =>
  transactions.filter(t => t.type === 'income'),
  [transactions]
);

// ExpenseAnalysis.tsx:19-22
const expenseTransactions = useMemo(() =>
  transactions.filter(t => t.type === 'expense'),
  [transactions]
);

// ========== 差异点 3: StatCard 配置 (第73-91行) ==========
// IncomeAnalysis.tsx:73-91
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
  showCurrency={false}
/>

// ExpenseAnalysis.tsx:73-91 (完全相同结构，只有文案不同)
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
  showCurrency={false}
/>

// ========== 差异点 4: 图表标题 ==========
// IncomeAnalysis.tsx:96,108,118,138
title="月度收入趋势"
title="收入类别分布"
title="收款账户分布"
title="收入明细"
title="单次收入 Top 50"

// ExpenseAnalysis.tsx:96,108,118,138 (对应"支出")
title="月度支出趋势"
title="支出类别分布"
title="支付账户分布"
title="支出明细"
title="单次支出 Top 50"
```

#### 重构建议

**创建文件**: `src/components/dashboard/TransactionAnalysis.tsx`

```tsx
interface TransactionAnalysisProps {
  transactions: Transaction[];
  monthlyData: MonthlyData[];
  type: 'income' | 'expense';  // 唯一差异点
}

export function TransactionAnalysis({ transactions, monthlyData, type }: TransactionAnalysisProps) {
  const isIncome = type === 'income';

  // 根据 type 选择颜色和文案
  const colorHex = isIncome
    ? getIncomeColorHex(settings.colorScheme)
    : getExpenseColorHex(settings.colorScheme);
  const colorClass = isIncome
    ? getIncomeColor(settings.colorScheme)
    : getExpenseColor(settings.colorScheme);

  // 根据 type 过滤数据
  const filteredTransactions = useMemo(() =>
    transactions.filter(t => t.type === type),
    [transactions, type]
  );

  // 文案配置
  const labels = isIncome ? {
    total: '总收入',
    monthly: '月均收入',
    count: '收入笔数',
    trend: '月度收入趋势',
    category: '收入类别分布',
    account: isIncome ? '收款账户分布' : '支付账户分布',
    detail: '收入明细',
    top: '单次收入 Top 50'
  } : {
    total: '总支出',
    monthly: '月均支出',
    count: '支出笔数',
    trend: '月度支出趋势',
    category: '支出类别分布',
    account: '支付账户分布',
    detail: '支出明细',
    top: '单次支出 Top 50'
  };

  // 其余逻辑完全相同...
}
```

**使用方式**:

```tsx
// src/pages/Index.tsx
{activeTab === 'income' && (
  <TransactionAnalysis
    transactions={allTransactions}
    monthlyData={monthlyData}
    type="income"
  />
)}
{activeTab === 'expense' && (
  <TransactionAnalysis
    transactions={allTransactions}
    monthlyData={monthlyData}
    type="expense"
  />
)}
```

**收益**: 减少 ~150 行代码

---

### 2. IncomeHeatmap vs ExpenseHeatmap

**重复度**: 98% 相似

| 文件 | 路径 | 行数 |
|------|------|------|
| IncomeHeatmap.tsx | `src/components/dashboard/IncomeHeatmap.tsx` | 219 |
| ExpenseHeatmap.tsx | `src/components/dashboard/ExpenseHeatmap.tsx` | 219 |

#### 差异点分析

```tsx
// ========== 差异点 1: 颜色选择逻辑 (第41-44行) ==========
// IncomeHeatmap.tsx:41-44
const COLORS = settings.colorScheme === 'swapped'
  ? ['#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#059669']
  : ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'];

// ExpenseHeatmap.tsx:41-44 (逻辑相反)
const COLORS = settings.colorScheme === 'swapped'
  ? ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22']
  : ['#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#059669'];

// ========== 差异点 2: 数据过滤 (第48-49行) ==========
// IncomeHeatmap.tsx:48-49
  const dailyData = useMemo(() => {
    return transactions
      .filter(t => t.type !== 'expense')  // 排除支出
      .reduce(...)

// ExpenseHeatmap.tsx:48-49
  const dailyData = useMemo(() => {
    return transactions
      .filter(t => t.type !== 'income')  // 排除收入
      .reduce(...)

// ========== 差异点 3: 图标和标题 (第66-67行, 第70行) ==========
// IncomeHeatmap.tsx
import { TrendingUp } from 'lucide-react';
<CardTitle>收入热力图</CardTitle>
<TooltipContent>查看每日收入分布</TooltipContent>

// ExpenseHeatmap.tsx
import { TrendingDown } from 'lucide-react';
<CardTitle>支出热力图</CardTitle>
<TooltipContent>查看每日支出分布</TooltipContent>
```

#### 重构建议

**创建文件**: `src/components/dashboard/TransactionHeatmap.tsx`

```tsx
interface TransactionHeatmapProps {
  transactions: Transaction[];
  year: number;
  type: 'income' | 'expense';
  colorPalette?: 'green' | 'red';  // 可选，默认根据 type 自动选择
}

export function TransactionHeatmap({ transactions, year, type, colorPalette }: TransactionHeatmapProps) {
  const { settings } = useSettings();

  // 自动推断颜色板
  const palette = colorPalette || (type === 'income' ? 'green' : 'red');

  // 根据类型和颜色方案选择颜色
  const COLORS = useMemo(() => {
    const GREEN_PALETTE = ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'];
    const RED_PALETTE = ['#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d', '#059669'];

    if (palette === 'green') {
      return settings.colorScheme === 'swapped' ? RED_PALETTE : GREEN_PALETTE;
    } else {
      return settings.colorScheme === 'swapped' ? GREEN_PALETTE : RED_PALETTE;
    }
  }, [settings.colorScheme, palette]);

  // 数据过滤
  const dailyData = useMemo(() => {
    return transactions
      .filter(t => t.type !== (type === 'income' ? 'expense' : 'income'))
      .reduce(...)
  }, [transactions, type]);

  // 其余逻辑完全相同...
}
```

**收益**: 减少 ~200 行代码

---

### 3. CapitalDashboard 的 4 个 PieChart 组件

**重复度**: 80% 相似

| 组件 | 路径 | 行数范围 |
|------|------|---------|
| CurrencyChart | `src/components/assets/CapitalDashboard.tsx` | 199-250 (52行) |
| StatusChart | `src/components/assets/CapitalDashboard.tsx` | 294-344 (51行) |
| MaturityChart | `src/components/assets/CapitalDashboard.tsx` | 390-441 (52行) |
| StrategyChart | `src/components/assets/CapitalDashboard.tsx` | 484-563 (80行) |

#### 完全相同的布局结构

```tsx
// ========== 所有4个组件共享相同布局 ==========
<div className="border rounded-xl p-6 space-y-4">
  <h3 className="text-lg font-semibold">{title}</h3>

  <div className="flex items-stretch gap-4">
    {/* Chart - 70% width */}
    <div className="w-[70%] h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>

    {/* Legend - 30% width */}
    <div className="w-[30%] space-y-1.5">
      {chartData.map((item) => (
        <div className="flex items-center justify-between gap-2 p-1.5 rounded whitespace-nowrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <p className="text-sm font-medium truncate">{item.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-right">
            <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
            <p className="text-sm font-bold">{formatCurrencyFull(item.value)}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

#### 差异点

```tsx
// ========== 唯一差异点 ==========

// 1. 数据来源
// CurrencyChart: data={currencyDistribution}
// StatusChart: data={statusDistribution}
// MaturityChart: data={maturityDistribution}
// StrategyChart: data={dashboardData.strategy_allocation}

// 2. 颜色映射
// CurrencyChart: CURRENCY_COLORS[item.currency]
// StatusChart: STATUS_COLORS[item.status]
// MaturityChart: MATURITY_COLORS[item.period]
// StrategyChart: STRATEGY_COLORS[item.strategy]

// 3. 点击交互 (仅 StrategyChart 有)
// StrategyChart: onClick, selectedStrategy, onStrategyClick
// 其他: 无交互
```

#### 重构建议

**创建文件**: `src/components/assets/DistributionPieChart.tsx`

```tsx
interface DistributionPieChartProps {
  title: string;
  data: Array<{
    name: string;
    value: number;
    percentage: number;
    color: string;
  }>;
  onClick?: (name: string) => void;
  selected?: string | null;
  showAction?: boolean;
}

export function DistributionPieChart({
  title,
  data,
  onClick,
  selected,
  showAction = false
}: DistributionPieChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrencyFull(data.value)} ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {showAction && selected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onClick?.(null)}
          >
            <EyeOff className="w-4 h-4 mr-1" />
            清除筛选
          </Button>
        )}
      </div>

      <div className="flex items-stretch gap-4">
        {/* Chart */}
        <div className="w-[70%] h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                onClick={onClick ? (entry) => onClick?.(
                  selected === entry.name ? null : entry.name
                ) : undefined}
                className={onClick ? "cursor-pointer" : ""}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={selected && selected !== entry.name ? 'transparent' : 'white'}
                    strokeWidth={2}
                    opacity={selected && selected !== entry.name ? 0.3 : 1}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="w-[30%] space-y-1.5">
          {data.map((item) => (
            <div
              key={item.name}
              className={cn(
                "flex items-center justify-between gap-2 p-1.5 rounded whitespace-nowrap",
                onClick ? "cursor-pointer transition-colors" : "",
                selected && selected !== item.name ? "opacity-30" : "hover:bg-muted/50",
                !selected && onClick && "hover:bg-muted/50"
              )}
              onClick={() => onClick?.(
                selected === item.name ? null : item.name
              )}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-sm font-medium truncate">{item.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</p>
                <p className="text-sm font-bold">{formatCurrencyFull(item.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**使用方式**:

```tsx
// 在 CapitalDashboard.tsx 中
import { DistributionPieChart } from './DistributionPieChart';

// 币种分布
<DistributionPieChart
  title="币种分布"
  data={currencyDistribution.map(item => ({
    name: item.currency,
    value: item.amount,
    percentage: item.percentage,
    color: CURRENCY_COLORS[item.currency]
  }))}
/>

// 状态分布
<DistributionPieChart
  title="状态分布"
  data={statusDistribution.map(item => ({
    name: item.status,
    value: item.amount,
    percentage: item.percentage,
    color: STATUS_COLORS[item.status]
  }))}
/>

// 策略分布 (带交互)
<DistributionPieChart
  title="策略分布"
  data={dashboardData.strategy_allocation.map(item => ({
    name: item.strategy,
    value: item.total_amount,
    percentage: item.percentage,
    color: STRATEGY_COLORS[item.strategy]
  }))}
  selected={selectedStrategy}
  onClick={setSelectedStrategy}
  showAction={true}
/>
```

**收益**: 减少 ~200 行代码

---

## 🟡 中优先级 - 重复的模式

### 4. 颜色映射常量

**问题**: 在多个文件中重复定义相同的颜色常量

#### 重复位置

```tsx
// ========== src/components/assets/CapitalDashboard.tsx (第38-67行) ==========
const STRATEGY_COLORS: Record<InvestmentStrategy, string> = {
  '远期理财': '#3b82f6',
  '美元资产': '#8b5cf6',
  '36存单': '#06b6d4',
  '长期理财': '#10b981',
  '短期理财': '#f59e0b',
  '中期理财': '#f97316',
  '进攻计划': '#ef4444',
  '麻麻理财': '#ec4899',
};

const CURRENCY_COLORS: Record<Currency, string> = {
  CNY: '#ef4444',
  USD: '#3b82f6',
  HKD: '#f59e0b',
};

const STATUS_COLORS: Record<UnitStatus, string> = {
  '已成立': '#10b981',
  '计划中': '#3b82f6',
  '筹集中': '#f59e0b',
  '已归档': '#6b7280',
};

const MATURITY_COLORS: Record<string, string> = {
  '已到期': '#ef4444',
  '7天内': '#f97316',
  '30天内': '#f59e0b',
  '90天内': '#3b82f6',
  '90天以上': '#10b981',
};

// ========== 其他组件中可能有类似的定义 ==========
```

#### 重构建议

**创建文件**: `src/lib/assetColors.ts`

```tsx
import type { InvestmentStrategy, Currency, UnitStatus } from '@/types/assets';

export const ASSET_COLORS = {
  STRATEGY: {
    '远期理财': '#3b82f6',  // blue
    '美元资产': '#8b5cf6',  // purple
    '36存单': '#06b6d4',    // cyan
    '长期理财': '#10b981',  // emerald
    '短期理财': '#f59e0b',  // amber
    '中期理财': '#f97316',  // orange
    '进攻计划': '#ef4444',  // red
    '麻麻理财': '#ec4899',  // pink
  } as Record<InvestmentStrategy, string>,

  CURRENCY: {
    CNY: '#ef4444',  // red
    USD: '#3b82f6',  // blue
    HKD: '#f59e0b',  // amber
  } as Record<Currency, string>,

  STATUS: {
    '已成立': '#10b981',  // emerald
    '计划中': '#3b82f6',  // blue
    '筹集中': '#f59e0b',  // amber
    '已归档': '#6b7280',  // gray
  } as Record<UnitStatus, string>,

  MATURITY: {
    '已到期': '#ef4444',    // red
    '7天内': '#f97316',     // orange
    '30天内': '#f59e0b',    // amber
    '90天内': '#3b82f6',    // blue
    '90天以上': '#10b981',  // emerald
  } as Record<string, string>,
};

// 辅助函数
export function getStrategyColor(strategy: InvestmentStrategy): string {
  return ASSET_COLORS.STRATEGY[strategy];
}

export function getCurrencyColor(currency: Currency): string {
  return ASSET_COLORS.CURRENCY[currency];
}

export function getStatusColor(status: UnitStatus): string {
  return ASSET_COLORS.STATUS[status];
}

export function getMaturityColor(period: string): string {
  return ASSET_COLORS.MATURITY[period] || '#6b7280';
}
```

**使用方式**:

```tsx
// 在 CapitalDashboard.tsx 中
import { ASSET_COLORS, getStrategyColor } from '@/lib/assetColors';

// 使用
<StrategyChart
  data={data.map(item => ({
    ...item,
    color: getStrategyColor(item.strategy)
  }))}
/>
```

**收益**: 统一管理，易于维护，减少 ~50 行代码

---

### 5. Tooltip 格式化逻辑

**问题**: 多个组件使用相同的 Tooltip 格式化逻辑

#### 重复位置

```tsx
// ========== src/components/assets/CapitalDashboard.tsx ==========
// CurrencyChart (第185-198行)
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrencyFull(data.value)} ({data.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

// StatusChart (第280-293行) - 完全相同
// MaturityChart (第376-389行) - 完全相同
// StrategyChart (第469-483行) - 完全相同

// ========== src/components/dashboard/AccountAnalysis.tsx (类似模式) ==========
// ========== src/components/dashboard/TransferAnalysis.tsx (类似模式) ==========
```

#### 重构建议

**创建文件**: `src/lib/chart-tooltip.tsx`

```tsx
import { formatCurrencyFull } from './chart-config';

interface TooltipData {
  name: string;
  value: number;
  percentage?: number;
  [key: string]: any;
}

interface PercentageTooltipOptions {
  valuePrefix?: string;
  valueSuffix?: string;
  showPercentage?: boolean;
  extraFields?: Array<{ key: string; label: string }>;
}

export function createPercentageTooltip(options: PercentageTooltipOptions = {}) {
  const {
    valuePrefix = '',
    valueSuffix = '',
    showPercentage = true,
    extraFields = []
  } = options;

  return ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as TooltipData;

      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {valuePrefix}{formatCurrencyFull(data.value)}{valueSuffix}
            {showPercentage && data.percentage !== undefined && (
              <span> ({data.percentage.toFixed(1)}%)</span>
            )}
          </p>
          {extraFields.map(field => (
            data[field.key] !== undefined && (
              <p key={field.label} className="text-sm text-muted-foreground">
                {field.label}: {data[field.key]}
              </p>
            )
          ))}
        </div>
      );
    }
    return null;
  };
}

// 预定义的 Tooltip 类型
export const PercentageTooltip = createPercentageTooltip();
export const CurrencyTooltip = createPercentageTooltip({ showPercentage: false });
```

**使用方式**:

```tsx
// 在组件中
import { PercentageTooltip } from '@/lib/chart-tooltip';

<PieChart>
  <Pie ... />
  <Tooltip content={<PercentageTooltip />} />
</PieChart>
```

**收益**: 减少 ~100 行重复代码

---

### 6. ChartCard 组件

**问题**: Card + Header + Content 布局重复 20+ 次

#### 重复位置

```tsx
// ========== 在多个文件中重复 ==========
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-primary" />
      {title}
    </CardTitle>
    <CardDescription>{description}</CardDescription>
  </CardHeader>
  <CardContent>
    {children}
  </CardContent>
</Card>

// 出现位置示例:
// - TransferAnalysis.tsx:160-196
// - AccountAnalysis.tsx:214-237
// - TransferAnalysis.tsx:237-260
// - 等等...
```

#### 重构建议

**创建文件**: `src/components/shared/ChartCard.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  description,
  icon: Icon,
  children,
  actions,
  className
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            {Icon ? (
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                {title}
              </CardTitle>
            ) : (
              <CardTitle>{title}</CardTitle>
            )}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

**使用方式**:

```tsx
// 原代码
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Calendar className="h-5 w-5 text-primary" />
      月度转账趋势
    </CardTitle>
    <CardDescription>每月转账金额变化</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="h-[350px]">...</div>
  </CardContent>
</Card>

// 使用 ChartCard
<ChartCard
  title="月度转账趋势"
  description="每月转账金额变化"
  icon={Calendar}
>
  <div className="h-[350px]">...</div>
</ChartCard>
```

**收益**: 减少 ~150 行代码

---

### 7. 筛选排序 Hook

**问题**: CapitalUnitsManager 和 ProductsLibrary 有相似的筛选排序逻辑

#### 重复位置

```tsx
// ========== src/components/assets/CapitalUnitsManager.tsx (第906-971行) ==========
const filteredUnits = useMemo(() => {
  if (!units) return [];

  let result = units.filter(unit => {
    if (filterStatus !== 'all' && unit.status !== filterStatus) return false;
    if (filterStrategy !== 'all' && unit.strategy !== filterStrategy) return false;
    if (filterTactics !== 'all' && unit.tactics !== filterTactics) return false;
    return true;
  });

  result.sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    // 特殊字段处理
    if (sortField === 'name') {
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal, 'zh-CN')
        : bVal.localeCompare(aVal, 'zh-CN');
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });

  return result;
}, [units, filterStatus, filterStrategy, filterTactics, sortField, sortOrder]);

// ========== src/components/assets/ProductsLibrary.tsx (类似模式) ==========
```

#### 重构建议

**创建文件**: `src/hooks/useFilteredAndSorted.ts`

```tsx
import { useMemo } from 'react';

export interface FilterConfig {
  [key: string]: any;
}

export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}

export interface UseFilteredAndSortedOptions<T> {
  items: T[] | undefined;
  filters?: FilterConfig;
  sort?: SortConfig;
  customSort?: (a: T, b: T, field: string, order: 'asc' | 'desc') => number;
}

export function useFilteredAndSorted<T extends Record<string, any>>({
  items,
  filters = {},
  sort,
  customSort
}: UseFilteredAndSortedOptions<T>): T[] {
  return useMemo(() => {
    if (!items) return [];

    let result = [...items];

    // 应用筛选
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== 'all' && value !== undefined) {
        result = result.filter(item => item[key] === value);
      }
    });

    // 应用排序
    if (sort) {
      result.sort((a, b) => {
        if (customSort) {
          return customSort(a, b, sort.field, sort.order);
        }

        const aVal = a[sort.field];
        const bVal = b[sort.field];

        // 字符串排序
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sort.order === 'asc'
            ? aVal.localeCompare(bVal, 'zh-CN')
            : bVal.localeCompare(aVal, 'zh-CN');
        }

        // 数字排序
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.order === 'asc' ? aVal - bVal : bVal - aVal;
        }

        return 0;
      });
    }

    return result;
  }, [items, filters, sort, customSort]);
}
```

**使用方式**:

```tsx
// 在 CapitalUnitsManager.tsx 中
import { useFilteredAndSorted } from '@/hooks/useFilteredAndSorted';

const filteredUnits = useFilteredAndSorted({
  items: units,
  filters: {
    status: filterStatus,
    strategy: filterStrategy,
    tactics: filterTactics
  },
  sort: {
    field: sortField,
    order: sortOrder
  }
});
```

**收益**: 减少 ~80 行代码

---

## 🟢 低优先级 - 优化提升

### 8. 网格布局组件

**问题**: 重复的网格布局模式

#### 重复位置

```tsx
// ========== 重复的 StatCard 网格 ==========
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <StatCard ... />
  <StatCard ... />
  <StatCard ... />
</div>

<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <StatCard ... />
  <StatCard ... />
  <StatCard ... />
  <StatCard ... />
</div>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <Chart ... />
  <Chart ... />
</div>
```

#### 重构建议

**创建文件**: `src/components/layout/StatGrid.tsx`

```tsx
import { cn, type ClassValue } from '@/lib/utils';
import { ReactNode } from 'react';

interface StatGridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
  gap?: '4' | '6';
  className?: string;
  responsive?: 'md' | 'lg';
}

export function StatGrid({
  children,
  cols = 3,
  gap = '4',
  className,
  responsive = 'md'
}: StatGridProps) {
  const gridCols: Record<number, string> = {
    1: 'grid-cols-1',
    2: `${responsive}:grid-cols-2`,
    3: `${responsive}:grid-cols-3`,
    4: `${responsive}:grid-cols-4`,
  };

  return (
    <div
      className={cn(
        'grid grid-cols-1',
        gridCols[cols],
        `gap-${gap}`,
        className
      )}
    >
      {children}
    </div>
  );
}
```

---

### 9. ChartContainer 组件

**问题**: ResponsiveContainer 包装重复 30+ 次

#### 重复位置

```tsx
// ========== 重复模式 ==========
<div className="h-[350px]">
  <ResponsiveContainer width="100%" height="100%">
    {children}
  </ResponsiveContainer>
</div>

<div className="h-[300px]">
  <ResponsiveContainer width="100%" height="100%">
    {children}
  </ResponsiveContainer>
</div>

<div className="h-[400px]">
  <ResponsiveContainer width="100%" height="100%">
    {children}
  </ResponsiveContainer>
</div>
```

#### 重构建议

**创建文件**: `src/components/chart/ChartContainer.tsx`

```tsx
import { ResponsiveContainer } from 'recharts';
import { ReactNode } from 'react';

interface ChartContainerProps {
  height?: number | string;
  width?: string | number;
  children: ReactNode;
  className?: string;
}

export function ChartContainer({
  height = 350,
  width = '100%',
  children,
  className
}: ChartContainerProps) {
  const heightClass = typeof height === 'number' ? `h-[${height}px]` : height;

  return (
    <div className={heightClass}>
      <ResponsiveContainer width={width} height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 📊 重构实施计划

### 阶段 1: 高优先级 (第1-2周)

1. ✅ 合并 IncomeHeatmap 和 ExpenseHeatmap
   - 创建 `TransactionHeatmap.tsx`
   - 更新 Index.tsx
   - 删除旧文件
   - 测试验证

2. ✅ 合并 IncomeAnalysis 和 ExpenseAnalysis
   - 创建 `TransactionAnalysis.tsx`
   - 更新 Index.tsx
   - 删除旧文件
   - 测试验证

3. ✅ 提取 CapitalDashboard 的 PieChart
   - 创建 `DistributionPieChart.tsx`
   - 更新 CapitalDashboard.tsx
   - 测试验证

### 阶段 2: 中优先级 (第3-4周)

4. ✅ 提取颜色映射常量
   - 创建 `lib/assetColors.ts`
   - 更新所有引用

5. ✅ 提取 Tooltip 格式化
   - 创建 `lib/chart-tooltip.tsx`
   - 更新所有图表组件

6. ✅ 创建 ChartCard 组件
   - 创建 `shared/ChartCard.tsx`
   - 逐步替换

7. ✅ 创建筛选排序 Hook
   - 创建 `useFilteredAndSorted.ts`
   - 更新 CapitalUnitsManager 和 ProductsLibrary

### 阶段 3: 低优先级 (第5-6周)

8. ✅ 创建布局组件
9. ✅ 创建 ChartContainer 组件

---

## ✅ 已有的良好实践

项目已经很好地提取了以下共享组件:

### Dashboard Shared Components
**位置**: `src/components/dashboard/shared/`

- ✅ `MonthlyTrendChart.tsx` - 月度趋势图
- ✅ `CategoryDistributionChart.tsx` - 分类分布图
- ✅ `AccountDistributionChart.tsx` - 账户分布图
- ✅ `CategoryDetailList.tsx` - 分类明细列表
- ✅ `TopTransactionsTable.tsx` - 顶级交易表

### Shared Hooks
**位置**: `src/hooks/useCategoryData.ts`

```tsx
// ✅ 已经很好地抽象了！
export function useCategoryData(transactions: Transaction[], totalAmount: number): CategoryData
export function useAccountData(transactions: Transaction[], totalAmount: number, limit?: number)
```

**这两个 hooks 被 IncomeAnalysis 和 ExpenseAnalysis 共享，做得非常好！**

---

## 📝 注意事项

1. **渐进式重构**: 不要一次性修改所有文件，逐步进行并测试
2. **保持向后兼容**: 重构过程中确保功能和界面完全一致
3. **类型安全**: 使用 TypeScript 确保类型正确
4. **测试覆盖**: 每次重构后进行完整的功能测试

---

**报告结束** - 等待你的 review 和指示！🚀
