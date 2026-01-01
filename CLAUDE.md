# 个人财务管理 - 项目规范文档

## 1. 颜色系统规范

### 1.1 核心原则
- **禁止硬编码颜色** - 所有颜色必须使用语义化的 CSS 变量或统一色板
- **语义化命名** - 使用 `income`/`expense` 而非 `green`/`red`
- **统一色板** - 使用 `@/lib/colorPalette.ts` 中的 20 色标准色板

### 1.2 统一色板系统

```tsx
import {
  UNIFIED_PALETTE,           // 18色基础色板 (Tailwind 500)
  STRATEGY_COLORS,            // 策略颜色 (8种)
  CURRENCY_COLORS,            // 币种颜色 (CNY/USD/HKD)
  STATUS_COLORS,              // 状态颜色
  MATURITY_COLORS,            // 到期颜色
  HEATMAP_GREEN_PALETTE,      // 收入热力图渐变
  HEATMAP_RED_PALETTE,        // 支出热力图渐变
  getPaletteColor,            // 按索引获取颜色
  getStrategyColor,           // 获取策略颜色
  getCategoryColor,           // 获取分类颜色
} from '@/lib/colorPalette';
```

### 1.3 使用规范

#### 场景 1: UI 组件颜色 (使用 CSS 变量)
```tsx
// ✅ 正确
className="text-income"    // 收入文本
className="text-expense"   // 支出文本

// ❌ 错误
className="text-green-600"
className="text-red-600"
```

#### 场景 2: 图表颜色 (使用统一色板)
```tsx
// ✅ 正确
import { STRATEGY_COLORS } from '@/lib/colorPalette';
<Bar fill={STRATEGY_COLORS['远期理财']} />

// ❌ 错误
<Bar fill="#3b82f6" />
```

#### 场景 3: 动态收入/支出颜色 (使用 SettingsContext)
```tsx
// ✅ 正确 - 支持颜色方案切换
import { getIncomeColorHex, getExpenseColorHex } from '@/contexts/SettingsContext';
const incomeHex = getIncomeColorHex(settings.colorScheme);

// ❌ 错误
const incomeHex = '#059669';
```

---

## 2. 金额格式化规范

### 2.1 核心原则
- **所有金额显示必须保留 2 位小数**，即使是 `.00`
- 使用人民币符号 `¥`
- 使用中文千位分隔符

### 2.2 格式化函数

```tsx
import { formatCurrencyFull, formatCurrencyK } from '@/lib/chart-config';

formatCurrencyFull(1234.5)    // "¥1,234.50"
formatCurrencyK(1234.5)       // "¥1.23k"
```

### 2.3 使用场景

```tsx
// ✅ 正确
<TableCell>{formatCurrencyFull(amount)}</TableCell>
<YAxis tickFormatter={formatCurrencyK} />

// ❌ 错误
<TableCell>¥{amount.toLocaleString()}</TableCell>
<YAxis tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
```

---

## 3. 图表统一样式规范

### 3.1 统一配置导入

```tsx
import {
  xAxisStyle, yAxisStyle, gridStyle, formatCurrencyFull, formatCurrencyK
} from '@/lib/chart-config';

import {
  PieTooltip,                    // 饼图 Tooltip
  CurrencyTooltip,               // 纯金额 Tooltip
  CurrencyPercentageTooltip,     // 带百分比 Tooltip
  MultiSeriesTooltip,            // 多系列 Tooltip
  createEChartsCurrencyTooltip,  // ECharts 货币图表
  createEChartsAxisTooltip,      // ECharts 坐标轴图表
} from '@/lib/chart-tooltip';
```

### 3.2 Recharts 图表标准

```tsx
// ✅ 标准写法
<XAxis dataKey="month" {...xAxisStyle} />
<YAxis {...yAxisStyle} tickFormatter={formatCurrencyK} />
<CartesianGrid {...gridStyle} />
<Tooltip content={<PieTooltip />} />  {/* 或 CurrencyTooltip/MultiSeriesTooltip */}
```

### 3.3 ECharts 图表标准

```tsx
// ✅ 标准写法
const option = {
  tooltip: createEChartsAxisTooltip(),
  xAxis: {
    axisLine: { lineStyle: { color: 'hsl(var(--border))' } },
    axisLabel: { color: 'hsl(var(--text-muted))' }
  },
  yAxis: {
    axisLabel: { color: 'hsl(var(--text-muted))', formatter: (v) => formatCurrencyK(v) },
    splitLine: { lineStyle: { color: 'hsl(var(--border))', opacity: 0.3 } }
  },
  series: [{ ... }]
};
```

### 3.4 字体颜色规范

```tsx
// ✅ 正确 - 使用 CSS 变量
style={{ fill: 'hsl(var(--text-main))' }}
style={{ fill: 'hsl(var(--text-muted))' }}
style={{ fill: 'hsl(var(--text-income))' }}

// ❌ 错误
style={{ fill: '#1e293b' }}
```

---

## 4. 开发检查清单

在提交代码前，请确认：

### 颜色
- [ ] 没有硬编码 `text-green-600` / `text-red-600`
- [ ] 没有硬编码 `#22c55e` / `#ef4444` 等 hex 值
- [ ] 图表使用 `@/lib/colorPalette.ts` 统一色板
- [ ] 动态收入/支出颜色通过 SettingsContext 获取

### 金额
- [ ] 所有金额使用 `formatCurrencyFull()`
- [ ] 金额显示 2 位小数 (包括 `.00`)
- [ ] 图表坐标轴使用 `formatCurrencyK()`

### 图表
- [ ] 坐标轴使用 `{...xAxisStyle}` / `{...yAxisStyle}`
- [ ] 网格线使用 `{...gridStyle}`
- [ ] Tooltip 使用统一组件 (`PieTooltip` / `CurrencyTooltip` 等)
- [ ] ECharts 使用 `createEChartsXxxTooltip()` 函数
- [ ] 标签颜色使用 CSS 变量

---

## 5. 常见错误示例

### 错误 1: 硬编码颜色
```tsx
// ❌ 错误
<span className="text-green-600">收入</span>
<Area stroke="#059669" />

// ✅ 正确
<span className="text-income">收入</span>
<Area stroke={getIncomeColorHsl(settings.colorScheme)} />
```

### 错误 2: 金额格式化
```tsx
// ❌ 错误
<span>¥{amount.toLocaleString()}</span>
<Tooltip formatter={(v) => `¥${v.toFixed(2)}`} />

// ✅ 正确
<span>{formatCurrencyFull(amount)}</span>
<Tooltip content={<CurrencyTooltip />} />
```

### 错误 3: 坐标轴样式
```tsx
// ❌ 错误
<XAxis axisLine={false} tickLine={false} />

// ✅ 正确
<XAxis {...xAxisStyle} />
```

---

## 6. 扩展指南

### 添加新的颜色变量

1. **在 `src/index.css` 添加 CSS 变量**
```css
--new-color: 200 100% 50%;
```

2. **在 `tailwind.config.ts` 注册类名**
```typescript
colors: { 'new-color': 'hsl(var(--new-color))' }
```

3. **在 SettingsContext 添加辅助函数** (如需动态切换)
```tsx
export function getNewColor(scheme: ColorScheme): string {
  return scheme === 'swapped' ? 'hsl(var(--other-color))' : 'hsl(var(--new-color))';
}
```

### 添加新的格式化函数

在 `src/lib/chart-config.tsx` 添加：

```tsx
export const formatNewType = (value: number): string => {
  return formattedString;
};
```

---

## 7. Supabase CLI 使用规范

### 7.1 核心原则

**只读操作** - 可以直接执行，无需确认：
- 检查 schema：`supabase db dump --schema public`
- 查看状态：`supabase status`
- 列出 migrations：`supabase migration list`
- 审计权限：`grep GRANT dump.sql`

**写操作** - 必须经过用户确认：
- 修改 schema：`supabase db push`
- 应用 migration：`supabase db reset`
- 执行 SQL：直接在数据库执行修改语句
- 修改权限：`GRANT`/`REVOKE` 操作

### 7.2 常用只读命令

```bash
# 获取完整 schema
supabase db dump --schema public

# 检查 RLS 策略
supabase db dump | grep "CREATE POLICY"

# 验证权限配置
supabase db dump | grep "GRANT.*TO \"anon\""

# 查看当前状态
supabase status
```

### 7.3 写操作流程

对于任何修改数据库的操作：

1. **生成 SQL 文件** - 创建 migration 或修复脚本
2. **展示给用户** - 说明将要执行的修改
3. **等待确认** - 用户确认后才能执行
4. **验证结果** - 执行后验证修改是否生效

### 7.4 安全审计

定期检查数据库安全配置：

```bash
# 1. Dump schema
supabase db dump --schema public > /tmp/current_schema.sql

# 2. 检查 anon 权限 (应该只有 USAGE)
grep "GRANT.*TO \"anon\"" /tmp/current_schema.sql

# 3. 检查 RLS 策略 (每个表应该有 4 个)
grep "CREATE POLICY" /tmp/current_schema.sql | wc -l
```
