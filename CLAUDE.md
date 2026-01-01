# 个人财务管理 - 项目规范文档

## 1. 颜色系统规范

### 1.1 核心原则
- **禁止硬编码颜色** - 所有颜色必须使用语义化的 CSS 变量或统一色板
- **语义化命名** - 使用 `income`/`expense` 而非 `green`/`red`
- **主题一致性** - 所有组件遵循统一的金融配色方案
- **统一色板** - 使用 `@/lib/colorPalette.ts` 中的 20 色标准色板

### 1.2 统一色板系统

#### 导入统一色板
```tsx
import {
  UNIFIED_PALETTE,
  STRATEGY_COLORS,
  CURRENCY_COLORS,
  STATUS_COLORS,
  MATURITY_COLORS,
  CATEGORY_COLORS,
  HEATMAP_GREEN_PALETTE,
  HEATMAP_RED_PALETTE,
  RICH_PALETTE,
  getPaletteColor,
  getStrategyColor,
  getCategoryColor,
} from '@/lib/colorPalette';
```

#### 20 色标准色板 (UNIFIED_PALETTE)
```tsx
// 暖色系
red: '#ef4444'        // Red-500
orange: '#f97316'     // Orange-500
amber: '#f59e0b'      // Amber-500
yellow: '#eab308'     // Yellow-500
rose: '#e11d48'       // Rose-600 (expense color)

// 冷色系
cyan: '#06b6d4'       // Cyan-500
sky: '#0ea5e9'        // Sky-500
blue: '#3b82f6'       // Blue-500
indigo: '#6366f1'     // Indigo-500
violet: '#8b5cf6'     // Violet-500
purple: '#a855f7'     // Purple-500
fuchsia: '#d946ef'    // Fuchsia-500
pink: '#ec4899'       // Pink-500

// 自然色系
lime: '#84cc16'       // Lime-500
green: '#22c55e'      // Green-500
emerald: '#10b981'    // Emerald-600 (income color)
teal: '#14b8a6'       // Teal-500

// 中性色系
slate: '#64748b'      // Slate-500
gray: '#6b7280'       // Gray-500
zinc: '#71717a'       // Zinc-500
stone: '#78716c'      // Stone-500
```

#### 资产专用颜色
```tsx
// 策略颜色
STRATEGY_COLORS['远期理财']  // '#3b82f6' (blue)
STRATEGY_COLORS['美元资产']  // '#8b5cf6' (violet)
STRATEGY_COLORS['36存单']    // '#06b6d4' (cyan)
// ... 等 8 种策略

// 币种颜色
CURRENCY_COLORS.CNY  // '#ef4444' (red)
CURRENCY_COLORS.USD  // '#3b82f6' (blue)
CURRENCY_COLORS.HKD  // '#f59e0b' (amber)

// 状态颜色
STATUS_COLORS['已成立']  // '#10b981' (emerald)
STATUS_COLORS['计划中']  // '#3b82f6' (blue)
STATUS_COLORS['筹集中']  // '#f59e0b' (amber)
STATUS_COLORS['已归档']  // '#6b7280' (gray)

// 到期颜色
MATURITY_COLORS['已到期']    // '#ef4444' (red)
MATURITY_COLORS['7天内']     // '#f97316' (orange)
MATURITY_COLORS['30天内']    // '#f59e0b' (amber)
MATURITY_COLORS['90天内']    // '#3b82f6' (blue)
MATURITY_COLORS['90天以上']  // '#10b981' (emerald)
```

#### 热力图色板
```tsx
// 收入热力图
HEATMAP_GREEN_PALETTE  // ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']

// 支出热力图
HEATMAP_RED_PALETTE    // ['#ebedf0', '#ffc1cc', '#ff8fab', '#f43f5e', '#be123c']
```

### 1.3 CSS 变量颜色

#### 收入色系 (Income - Emerald)
```css
/* CSS 变量 */
--income: 160 84% 39%;            /* Emerald-600: #059669 */
--income-foreground: 210 40% 98%;  /* Slate-50 */
--income-bg: 160 84% 97%;         /* Emerald-50 */
--income-dark: 160 84% 45%;       /* Emerald-500 */
--income-light: 160 84% 95%;      /* Emerald-100 */
```

#### 支出色系 (Expense - Rose)
```css
/* CSS 变量 */
--expense: 350 89% 60%;           /* Rose-600: #e11d48 */
--expense-foreground: 210 40% 98%; /* Slate-50 */
--expense-bg: 350 89% 97%;        /* Rose-50 */
--expense-dark: 350 89% 65%;      /* Rose-500 */
--expense-light: 350 89% 95%;     /* Rose-100 */
```

#### 文本色系
```css
--text-main: hsl(var(--foreground));           /* 主要文本 */
--text-secondary: hsl(var(--muted-foreground)); /* 次要文本 */
--text-muted: hsl(var(--muted-foreground));     /* 弱化文本 */
--text-income: hsl(var(--income));             /* 收入文本 */
--text-expense: hsl(var(--expense));           /* 支出文本 */
```

### 1.4 使用规范

#### 场景 1: UI 组件颜色 (使用 CSS 变量)
```tsx
// ✅ 正确 - 使用语义类名
className="text-income"    // 收入文本
className="text-expense"   // 支出文本

// ❌ 错误 - 禁止硬编码
className="text-green-600"
className="text-red-600"
className="text-emerald-600"
```

#### 场景 2: 图表颜色 (使用统一色板)
```tsx
// ✅ 正确 - 使用统一色板
import { STRATEGY_COLORS, getCategoryColor } from '@/lib/colorPalette';

<Bar fill={STRATEGY_COLORS['远期理财']} />
<Area stroke={getCategoryColor('日常吃喝')} />
<Pie fill={getPaletteColor(index)} />

// ❌ 错误 - 硬编码颜色
<Bar fill="#3b82f6" />
<Area stroke="#ef4444" />
```

#### 场景 3: 动态收入/支出颜色 (使用 SettingsContext)
```tsx
// ✅ 正确 - 支持颜色方案切换
import { getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';

const incomeHex = getIncomeColorHex(settings.colorScheme);
const expenseHex = getExpenseColorHex(settings.colorScheme);

// ❌ 错误 - 不支持颜色方案切换
const incomeHex = '#059669';
const expenseHex = '#e11d48';
```

---

## 2. 金额格式化规范

### 2.1 核心原则
- **所有金额显示必须保留 2 位小数**，即使是 `.00`
- 使用人民币符号 `¥`
- 使用中文千位分隔符

### 2.2 格式化函数

从 `@/lib/chart-config` 导入标准格式化函数：

```tsx
import { formatCurrencyFull, formatCurrencyK } from '@/lib/chart-config';
```

#### formatCurrencyFull() - 完整金额
```tsx
// 用于所有金额显示
formatCurrencyFull(1234.5)    // "¥1,234.50"
formatCurrencyFull(1000)      // "¥1,000.00"
formatCurrencyFull(123456.78) // "¥123,456.78"
```

#### formatCurrencyK() - 简化金额 (K单位)
```tsx
// 用于图表坐标轴等需要简化的场景
formatCurrencyK(1234.5)    // "¥1.23k"
formatCurrencyK(1000)      // "¥1.00k"
formatCurrencyK(123456.78) // "¥123.46k"
```

### 2.3 使用场景

#### 表格/列表
```tsx
// ✅ 正确
<TableCell className="text-right">
  {formatCurrencyFull(transaction.amount)}
</TableCell>

// ❌ 错误
<TableCell className="text-right">
  ¥{transaction.amount.toLocaleString()}
</TableCell>
```

#### 图表 Tooltip
```tsx
// ✅ 正确
<Tooltip
  formatter={(value: number) => [formatCurrencyFull(value), '金额']}
  contentStyle={tooltipStyle.contentStyle}
/>

// ❌ 错误
<Tooltip
  formatter={(value: number) => `¥${value.toFixed(2)}`}
/>
```

#### 统计卡片
```tsx
// ✅ 正确
<p className="text-2xl font-bold">
  {formatCurrencyFull(totalIncome)}
</p>

// ❌ 错误
<p className="text-2xl font-bold">
  ¥{totalIncome.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}
</p>
```

### 2.4 不格式化的场景

**只有计数值（如笔数、条数）不格式化为金额**：

```tsx
// ✅ 正确 - 笔数不需要金额格式化
<StatCard
  title="交易笔数"
  value={transactionCount}
  showCurrency={false}  // 不显示货币符号
/>

// ✅ 正确 - 直接显示数字
<span>{transactions.length} 条记录</span>
```

---

## 3. 图表统一样式规范

### 3.1 统一 Chart 配置

所有图表必须使用统一的配置组件和样式：

```tsx
import {
  xAxisStyle,
  yAxisStyle,
  gridStyle,
  tooltipStyle,
  formatCurrencyFull,
  formatCurrencyK
} from '@/lib/chart-config';

import {
  CurrencyPercentageTooltip,
  CurrencyTooltip,
  PieTooltip,
  MultiSeriesTooltip,
  createEChartsCurrencyTooltip,
  createEChartsAxisTooltip
} from '@/lib/chart-tooltip';
```

### 3.2 Recharts 图表标准

#### 坐标轴样式 (必选)
```tsx
// ✅ 正确 - 使用统一样式
<XAxis
  dataKey="month"
  {...xAxisStyle}  // ✅ 必须使用
/>

<YAxis
  {...yAxisStyle}  // ✅ 必须使用
  tickFormatter={formatCurrencyK}  // ✅ 金额轴必须使用
/>

<CartesianGrid {...gridStyle} />  // ✅ 必须使用
```

#### Tooltip 组件 (必选)

**推荐使用统一的 Tooltip 组件**：

```tsx
// 1. 饼图/环形图 - 使用 PieTooltip
import { PieTooltip } from '@/lib/chart-tooltip';

<PieChart>
  <Pie ... />
  <Tooltip content={<PieTooltip />} />
</PieChart>

// 2. 带百分比的图表 - 使用 CurrencyPercentageTooltip
import { CurrencyPercentageTooltip } from '@/lib/chart-tooltip';

<BarChart>
  <Bar dataKey="value" />
  <Tooltip content={<CurrencyPercentageTooltip />} />
</BarChart>

// 3. 纯金额图表 - 使用 CurrencyTooltip
import { CurrencyTooltip } from '@/lib/chart-tooltip';

<AreaChart>
  <Area dataKey="amount" />
  <Tooltip content={<CurrencyTooltip />} />
</AreaChart>

// 4. 多系列图表 - 使用 MultiSeriesTooltip
import { MultiSeriesTooltip } from '@/lib/chart-tooltip';

<LineChart>
  <Line dataKey="income" />
  <Line dataKey="expense" />
  <Tooltip content={<MultiSeriesTooltip seriesLabels={['收入', '支出']} />} />
</LineChart>
```

**传统方式（兼容但不推荐）**：

```tsx
// ⚠️ 兼容方式，但推荐使用上面的组件
<Tooltip
  formatter={(value: number) => [formatCurrencyFull(value), '金额']}
  contentStyle={tooltipStyle.contentStyle}
/>
```

#### Legend 样式 (可选)
```tsx
<Legend {...legendStyle} />
```

### 3.3 ECharts 图表标准

#### Tooltip 配置

```tsx
// 1. 货币图表（饼图、桑基图等）
import { createEChartsCurrencyTooltip } from '@/lib/chart-tooltip';

const option = {
  tooltip: createEChartsCurrencyTooltip(),
  series: [...]
};

// 2. 坐标轴图表（折线图、柱状图等）
import { createEChartsAxisTooltip } from '@/lib/chart-tooltip';

const option = {
  tooltip: createEChartsAxisTooltip(),
  xAxis: { ... },
  yAxis: { ... },
  series: [...]
};
```

### 3.4 标准示例

#### 完整的 Recharts 柱状图示例
```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { xAxisStyle, yAxisStyle, gridStyle } from '@/lib/chart-config';
import { CurrencyTooltip } from '@/lib/chart-tooltip';

function MyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid {...gridStyle} />
        <XAxis dataKey="name" {...xAxisStyle} />
        <YAxis {...yAxisStyle} tickFormatter={formatCurrencyK} />
        <Tooltip content={<CurrencyTooltip />} />
        <Bar dataKey="value" fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

#### 完整的 ECharts 折线图示例
```tsx
import ReactECharts from 'echarts-for-react';
import { createEChartsAxisTooltip } from '@/lib/chart-tooltip';

function MyLineChart({ data }) {
  const option = {
    tooltip: createEChartsAxisTooltip(),
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
      axisLabel: { color: 'hsl(var(--text-muted))' }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
      axisLabel: {
        color: 'hsl(var(--text-muted))',
        formatter: (v: number) => formatCurrencyK(v)
      },
      splitLine: {
        lineStyle: { color: 'hsl(var(--border))', opacity: 0.3 }
      }
    },
    series: [{
      type: 'line',
      data: data.map(d => d.value),
      lineStyle: { color: 'hsl(var(--income))', width: 2 }
    }]
  };

  return <ReactECharts option={option} style={{ height: '400px' }} />;
}
```

### 3.4 字体颜色规范

```tsx
// ✅ 正确 - 使用 CSS 变量
style={{ fill: 'hsl(var(--text-main))' }}      // 主要文本
style={{ fill: 'hsl(var(--text-muted))' }}     // 弱化文本
style={{ fill: 'hsl(var(--text-income))' }}    // 收入文本
style={{ fill: 'hsl(var(--text-expense))' }}   // 支出文本

// ❌ 错误 - 硬编码颜色
style={{ fill: '#1e293b' }}
style={{ fill: 'rgb(30, 41, 59)' }}
```

### 3.5 标签/Label 样式

```tsx
// Pie Chart Label
<Pie
  label={(entry) => `${entry.name} ${formatCurrencyFull(entry.value)}`}
  labelStyle={{
    fontSize: '11px',
    fontWeight: '500',
    fill: 'hsl(var(--text-main))'  // ✅ 使用 CSS 变量
  }}
/>

// Bar/Line Chart Labels
<Bar
  label={{
    position: 'top',
    formatter: formatCurrencyK,
    style: {
      fontSize: '10px',
      fill: 'hsl(var(--text-muted))'  // ✅ 使用 CSS 变量
    }
  }}
/>
```

---

## 4. 开发检查清单

在提交代码前，请确认：

### 颜色检查
- [ ] 没有硬编码的 `text-green-600` / `text-red-600`
- [ ] 没有硬编码的 `#22c55e` / `#ef4444` 等 hex 值
- [ ] UI 组件使用 `text-income` / `text-expense` 类
- [ ] 图表使用 `@/lib/colorPalette.ts` 中的统一色板
- [ ] 资产相关使用 `STRATEGY_COLORS` / `CURRENCY_COLORS` 等
- [ ] 动态收入/支出颜色通过 SettingsContext 函数获取
- [ ] 热力图使用 `HEATMAP_GREEN_PALETTE` / `HEATMAP_RED_PALETTE`

### 金额检查
- [ ] 所有金额显示使用 `formatCurrencyFull()`
- [ ] 金额都显示 2 位小数 (包括 `.00`)
- [ ] 只有计数值不格式化为金额
- [ ] 图表坐标轴使用 `formatCurrencyK()`

### 图表检查
- [ ] 所有坐标轴使用 `{...xAxisStyle}` / `{...yAxisStyle}`
- [ ] 网格线使用 `{...gridStyle}`
- [ ] Tooltip 使用统一组件（`PieTooltip` / `CurrencyTooltip` 等）
- [ ] 或使用 `tooltipStyle.contentStyle`（兼容方式）
- [ ] ECharts 使用 `createEChartsCurrencyTooltip()` 或 `createEChartsAxisTooltip()`
- [ ] Legend 使用 `{...legendStyle}`（可选）
- [ ] 标签颜色使用 CSS 变量
- [ ] 金额 formatter 使用 `formatCurrencyFull()`

### 新建图表检查
- [ ] 使用统一的 chart-tooltip 组件，而非自定义 CustomTooltip
- [ ] 饼图使用 `<Tooltip content={<PieTooltip />} />`
- [ ] 柱状图/面积图使用 `<Tooltip content={<CurrencyTooltip />} />`
- [ ] 多系列图表使用 `<Tooltip content={<MultiSeriesTooltip />} />`

---

## 5. 常见错误示例

### 错误 1: 硬编码颜色类
```tsx
// ❌ 错误
<span className="text-green-600">收入</span>
<span className="text-red-600">支出</span>

// ✅ 正确
<span className="text-income">收入</span>
<span className="text-expense">支出</span>
```

### 错误 2: 硬编码 Hex 颜色
```tsx
// ❌ 错误
<Area stroke="#059669" />

// ✅ 正确
const { settings } = useSettings();
const incomeHsl = getIncomeColorHsl(settings.colorScheme);
<Area stroke={incomeHsl} />
```

### 错误 3: 金额不显示小数
```tsx
// ❌ 错误
<span>¥{amount.toLocaleString()}</span>

// ✅ 正确
<span>{formatCurrencyFull(amount)}</span>
```

### 错误 4: 图表坐标轴样式不一致
```tsx
// ❌ 错误
<XAxis
  axisLine={false}
  tickLine={false}
  tick={{ fontSize: 12 }}
/>

// ✅ 正确
<XAxis {...xAxisStyle} />
```

---

## 6. 扩展指南

### 添加新的颜色变量

如果需要添加新的语义颜色，按以下步骤：

1. **在 `src/index.css` 添加 CSS 变量**
```css
:root {
  --new-color: 200 100% 50%;
}
```

2. **在 `tailwind.config.ts` 注册类名**
```typescript
colors: {
  'new-color': 'hsl(var(--new-color))',
}
```

3. **在 SettingsContext 添加辅助函数 (如需动态切换)**
```tsx
export function getNewColor(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'hsl(var(--other-color))' : 'hsl(var(--new-color))';
}
```

### 添加新的格式化函数

在 `src/lib/chart-config.tsx` 添加：

```tsx
export const formatNewType = (value: number): string => {
  // 格式化逻辑
  return formattedString;
};
```
