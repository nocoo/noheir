# 个人财务管理 - 项目规范文档

## 1. 颜色系统规范

### 1.1 核心原则
- **禁止硬编码颜色** - 所有颜色必须使用语义化的 CSS 变量或 Tailwind 类
- **语义化命名** - 使用 `income`/`expense` 而非 `green`/`red`
- **主题一致性** - 所有组件遵循统一的金融配色方案

### 1.2 颜色变量定义

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

### 1.3 Tailwind 类名使用

#### 文本颜色
```tsx
// ✅ 正确 - 使用语义类名
className="text-income"    // 收入文本
className="text-expense"   // 支出文本

// ❌ 错误 - 禁止硬编码
className="text-green-600"
className="text-red-600"
className="text-emerald-600"
```

#### 背景颜色
```tsx
// ✅ 正确
className="bg-income"      // 收入背景
className="bg-expense"     // 支出背景
className="bg-income-bg"   // 收入浅色背景

// ❌ 错误
className="bg-green-500"
className="bg-red-500"
```

### 1.4 动态颜色获取

#### SettingsContext 颜色函数

```tsx
import { getIncomeColor, getExpenseColor, getIncomeColorHsl, getExpenseColorHsl, getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
import { useSettings } from '@/contexts/SettingsContext';

const { settings } = useSettings();

// CSS 类名 (用于 className)
const incomeClass = getIncomeColor(settings.colorScheme);      // 'text-income'
const expenseClass = getExpenseColor(settings.colorScheme);    // 'text-expense'

// HSL 格式 (用于 style 属性)
const incomeHsl = getIncomeColorHsl(settings.colorScheme);      // 'hsl(var(--income))'
const expenseHsl = getExpenseColorHsl(settings.colorScheme);    // 'hsl(var(--expense))'

// Hex 格式 (用于 ECharts 等需要 hex 的库)
const incomeHex = getIncomeColorHex(settings.colorScheme);      // '#059669'
const expenseHex = getExpenseColorHex(settings.colorScheme);    // '#e11d48'
```

#### Recharts 图表使用
```tsx
// ✅ 正确 - 使用 HSL 格式
<Area stroke={incomeHsl} fill={incomeHsl} />
<Bar fill={expenseHsl} />
<Line stroke={incomeHsl} />

// ❌ 错误 - 硬编码
<Area stroke="#059669" />
<Bar fill="#e11d48" />
```

#### ECharts 使用
```tsx
// ✅ 正确 - 使用 Hex 格式
const option = {
  color: [incomeHex, expenseHex, ...],
  itemStyle: { color: incomeHex }
};

// ❌ 错误
const option = {
  color: ['#059669', '#e11d48']
};
```

### 1.5 颜色方案切换 (Swapped)

系统支持颜色方案切换（默认 vs 交换），所有颜色获取必须通过 SettingsContext：

```tsx
// SettingsContext 会自动处理方案切换
const incomeColor = getIncomeColor(settings.colorScheme);
// default: 'text-income'
// swapped: 'text-expense'

const expenseColor = getExpenseColor(settings.colorScheme);
// default: 'text-expense'
// swapped: 'text-income'
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

### 3.1 坐标轴样式

所有图表坐标轴必须使用统一的样式配置：

```tsx
import { xAxisStyle, yAxisStyle, gridStyle, tooltipStyle, legendStyle } from '@/lib/chart-config';

// X 轴
<XAxis
  dataKey="month"
  {...xAxisStyle}  // ✅ 必须使用统一样式
/>

// Y 轴
<YAxis
  {...yAxisStyle}  // ✅ 必须使用统一样式
  tickFormatter={formatCurrencyK}  // ✅ 金额轴必须使用 formatCurrencyK
/>

// 网格线
<CartesianGrid {...gridStyle} />  // ✅ 必须使用统一样式
```

#### 统一样式配置 (chart-config.tsx)

```tsx
export const xAxisStyle = {
  axisLine: false,
  tickLine: false,
  style: { fontSize: '11px', fill: 'hsl(var(--text-muted))' }
};

export const yAxisStyle = {
  axisLine: false,
  tickLine: false,
  style: { fontSize: '11px', fill: 'hsl(var(--text-muted))' }
};

export const gridStyle = {
  strokeDasharray: '3 3',
  style: { stroke: 'hsl(var(--border))', opacity: 0.3 }
};
```

### 3.2 Tooltip 样式

```tsx
<Tooltip
  formatter={(value: number) => [formatCurrencyFull(value), '金额']}  // ✅ 金额必须格式化
  contentStyle={tooltipStyle.contentStyle}  // ✅ 必须使用统一样式
  itemStyle={{ color: 'hsl(var(--foreground))' }}
/>
```

#### 统一 Tooltip 样式

```tsx
export const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    fontSize: '12px',
    color: 'hsl(var(--popover-foreground))'
  }
};
```

### 3.3 Legend 样式

```tsx
<Legend {...legendStyle} />  // ✅ 必须使用统一样式
```

```tsx
export const legendStyle = {
  wrapperStyle: { paddingTop: '16px' },
  iconType: 'circle',
  formatter: (value: string) => <span style={{ color: 'hsl(var(--text-main))' }}>{value}</span>
};
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
- [ ] 所有收入/支出颜色使用 `text-income` / `text-expense` 类
- [ ] 动态颜色通过 SettingsContext 函数获取
- [ ] Recharts 使用 HSL 格式，ECharts 使用 Hex 格式

### 金额检查
- [ ] 所有金额显示使用 `formatCurrencyFull()`
- [ ] 金额都显示 2 位小数 (包括 `.00`)
- [ ] 只有计数值不格式化为金额
- [ ] 图表坐标轴使用 `formatCurrencyK()`

### 图表检查
- [ ] 所有坐标轴使用 `{...xAxisStyle}` / `{...yAxisStyle}`
- [ ] Tooltip 使用 `tooltipStyle.contentStyle`
- [ ] Legend 使用 `{...legendStyle}`
- [ ] 标签颜色使用 CSS 变量
- [ ] 金额 formatter 使用 `formatCurrencyFull()`

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
